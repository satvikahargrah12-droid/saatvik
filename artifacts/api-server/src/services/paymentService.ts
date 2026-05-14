import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  cartTable,
  cartItemsTable,
  productsTable,
  deliveryAreasTable,
  settingsTable,
  snacksTable,
  paymentsTable,
} from "@workspace/db";
import { getRazorpayClient, getRazorpayEnvDiagnosticsForLog, getRazorpayKeySecret } from "../config/razorpay";
import { logger } from "../lib/logger";

/** Snapshot stored on the payment row until Razorpay checkout completes */
export type FulfillmentType = "DELIVERY" | "TAKE_AWAY" | "DINE_IN";

export type CheckoutSnapshotV1 = {
  version: 1;
  fulfillment_type: FulfillmentType;
  delivery_area_id: number | null;
  /** Full delivery address when fulfillment is DELIVERY (stored at checkout start). */
  delivery_address?: string | null;
  delivery_charge: string;
  subtotal: string;
  total: string;
  lines: Array<{
    productId: number | null;
    snackId: number | null;
    quantity: number;
    price: string;
  }>;
};

async function computeDeliveryDateFromSettings(): Promise<string> {
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.status, 1)).limit(1);
  let deliveryDate = new Date();
  if (settings?.orderCutoffTime) {
    const now = new Date();
    const [h, m] = settings.orderCutoffTime.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(h!, m!, 0, 0);
    if (now > cutoff) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }
  }
  return deliveryDate.toISOString().split("T")[0]!;
}


function normalizeDeliveryAddress(raw: string | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function buildCheckoutSnapshot(
  userId: number,
  fulfillmentType: FulfillmentType,
  deliveryAreaId: number | undefined,
  deliveryAddressRaw: string | undefined,
): Promise<{ ok: true; snapshot: CheckoutSnapshotV1; amountPaise: number } | { ok: false; error: string; status: number }> {
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.status, 1)).limit(1);
  if (settings?.maintenanceMode) {
    return { ok: false, error: "Ordering is temporarily disabled for maintenance", status: 400 };
  }

  const isDelivery = fulfillmentType === "DELIVERY";
  const deliveryAddress = normalizeDeliveryAddress(deliveryAddressRaw);
  let area: typeof deliveryAreasTable.$inferSelect | undefined;
  if (isDelivery) {
    if (deliveryAreaId == null) {
      return { ok: false, error: "delivery_area_id is required for delivery orders", status: 400 };
    }
    if (!deliveryAddress || deliveryAddress.length < 5) {
      return {
        ok: false,
        error: "delivery_address is required for delivery orders (at least 5 characters)",
        status: 400,
      };
    }
    if (deliveryAddress.length > 2000) {
      return { ok: false, error: "delivery_address must be at most 2000 characters", status: 400 };
    }
    const [activeArea] = await db.select().from(deliveryAreasTable).where(eq(deliveryAreasTable.id, deliveryAreaId)).limit(1);
    if (!activeArea || activeArea.status !== 1) {
      return { ok: false, error: "Selected delivery area is not available", status: 400 };
    }
    area = activeArea;
  }

  const [cart] = await db
    .select()
    .from(cartTable)
    .where(and(eq(cartTable.userId, userId), eq(cartTable.status, 1)))
    .limit(1);
  if (!cart) {
    return { ok: false, error: "Cart is empty", status: 400 };
  }

  const cartItems = await db
    .select()
    .from(cartItemsTable)
    .leftJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .leftJoin(snacksTable, eq(cartItemsTable.snackId, snacksTable.id))
    .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.status, 1)));

  if (cartItems.length === 0) {
    return { ok: false, error: "Cart is empty", status: 400 };
  }

  const lines: CheckoutSnapshotV1["lines"] = [];
  let subtotal = 0;
  for (const row of cartItems) {
    const priceStr = row.products?.price || row.snacks?.price || "0";
    const qty = row.cart_items.quantity;
    subtotal += parseFloat(priceStr) * qty;
    lines.push({
      productId: row.cart_items.productId,
      snackId: row.cart_items.snackId,
      quantity: qty,
      price: priceStr,
    });
  }

  const deliveryCharge = isDelivery ? parseFloat(area!.deliveryCharge.toString()) : 0;
  const total = subtotal + deliveryCharge;
  const snapshot: CheckoutSnapshotV1 = {
    version: 1,
    fulfillment_type: fulfillmentType,
    delivery_area_id: isDelivery ? deliveryAreaId! : null,
    delivery_address: isDelivery ? deliveryAddress : null,
    delivery_charge: deliveryCharge.toFixed(2),
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    lines,
  };
  const amountPaise = Math.round(total * 100);

  return { ok: true, snapshot, amountPaise };
}

/**
 * Step 2 — Create Razorpay order + persist a payment row (no app order yet).
 */
export async function createRazorpayCheckout(
  userId: number,
  fulfillmentType: FulfillmentType,
  deliveryAreaId: number | undefined,
  deliveryAddress: string | undefined,
  clientAmountPaise: number | undefined,
): Promise<
  | { ok: true; razorpay_order_id: string; amount: number; currency: string }
  | { ok: false; error: string; status: number }
> {
  const built = await buildCheckoutSnapshot(userId, fulfillmentType, deliveryAreaId, deliveryAddress);
  if (!built.ok) {
    return built;
  }

  if (clientAmountPaise !== undefined && clientAmountPaise !== built.amountPaise) {
    return {
      ok: false,
      error: "Amount mismatch — totals may have changed. Refresh and try again.",
      status: 400,
    };
  }

  let rzp;
  try {
    rzp = getRazorpayClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(
      { err: e, payment: "create-order", step: "razorpay-client-init", env: getRazorpayEnvDiagnosticsForLog() },
      `[payment] Razorpay client could not be created: ${msg}`,
    );
    return {
      ok: false,
      error: `Razorpay is not configured for the API process: ${msg}. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the same .env the api-server loads.`,
      status: 503,
    };
  }

  let rzpOrder: { id: string };
  try {
    rzpOrder = (await rzp.orders.create({
      amount: built.amountPaise,
      currency: "INR",
      receipt: `uid_${userId}_${Date.now()}`,
      notes: {
        user_id: String(userId),
        delivery_area_id: deliveryAreaId != null ? String(deliveryAreaId) : "",
        fulfillment_type: fulfillmentType,
        delivery_address: built.snapshot.delivery_address?.slice(0, 200) ?? "",
      },
    })) as { id: string };
  } catch (err: unknown) {
    const e = err as {
      error?: { description?: string; code?: string; source?: string; step?: string; reason?: string };
      message?: string;
      statusCode?: number;
    };
    const rzpMsg =
      e?.error?.description ??
      e?.error?.code ??
      (typeof e?.message === "string" && e.message !== "[object Object]" ? e.message : undefined) ??
      (err instanceof Error ? err.message : undefined) ??
      String(err);
    // 401 = wrong key id/secret pair (Razorpay); avoid misleading "Bad Gateway" for this case.
    const isAuthFailure = e.statusCode === 401 || e?.error?.description === "Authentication failed";
    const httpStatus = isAuthFailure ? 401 : typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 502;

    const errorMessage = rzpMsg
      ? `Razorpay rejected the request: ${rzpMsg}`
      : `Failed to create payment order with Razorpay.`;

    const envDiag = getRazorpayEnvDiagnosticsForLog();
    const logPayload = {
      err: err,
      payment: "create-order",
      step: "razorpay.orders.create",
      checkout: { userId, deliveryAreaId, amountPaise: built.amountPaise, currency: "INR" },
      razorpay: {
        httpStatus: e.statusCode,
        errorCode: e.error?.code,
        errorDescription: e.error?.description,
        errorSource: e.error?.source,
        errorStep: e.error?.step,
        errorReason: e.error?.reason,
      },
      env: envDiag,
      ...(isAuthFailure
        ? {
            hint:
              "401 Authentication failed: Key Id and Key Secret must be from the same Razorpay account and same mode (test vs live). Regenerate secret in Dashboard → API Keys. Restart api-server after editing .env.",
          }
        : {}),
    };

    logger.error(logPayload, `[payment] Razorpay orders.create failed → HTTP ${httpStatus}: ${errorMessage}`);

    return {
      ok: false,
      error: errorMessage,
      status: httpStatus,
    };
  }

  try {
    await db.insert(paymentsTable).values({
      userId,
      deliveryAreaId: built.snapshot.delivery_area_id,
      orderId: null,
      checkoutSnapshot: JSON.stringify(built.snapshot),
      razorpayOrderId: rzpOrder.id,
      amount: built.amountPaise,
      currency: "INR",
      status: "created",
    });
  } catch (dbErr: unknown) {
    logger.error(
      {
        err: dbErr,
        payment: "create-order",
        step: "payments.insert",
        razorpayOrderId: rzpOrder.id,
        checkout: { userId, deliveryAreaId, amountPaise: built.amountPaise },
      },
      "[payment] DB insert failed after Razorpay order was created (orphaned Razorpay order — reconcile in dashboard if needed)",
    );
    return {
      ok: false,
      error: "Payment started at Razorpay but saving the checkout record failed (database). Check API logs.",
      status: 500,
    };
  }

  return {
    ok: true,
    razorpay_order_id: rzpOrder.id,
    amount: built.amountPaise,
    currency: "INR",
  };
}

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const generated = crypto.createHmac("sha256", getRazorpayKeySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return generated === signature;
}

type PaymentRow = typeof paymentsTable.$inferSelect;

/**
 * Persist app order + line items + clear cart + link payment (after HMAC verify on POST /payment/verify).
 * Idempotent when payment.orderId is already set.
 */
async function finalizeCheckoutFromSnapshotPayment(
  payment: PaymentRow,
  userId: number,
  razorpay_payment_id: string,
  razorpay_order_id: string,
  razorpay_signature: string | null,
): Promise<number> {
  if (payment.orderId != null) {
    return payment.orderId;
  }

  if (!payment.checkoutSnapshot) {
    throw new Error("Checkout data missing for this payment");
  }

  const snapshot = JSON.parse(payment.checkoutSnapshot) as CheckoutSnapshotV1;
  if (snapshot.version !== 1) {
    throw new Error("Unsupported checkout snapshot version");
  }

  const deliveryDate = await computeDeliveryDateFromSettings();

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      fulfillmentType: snapshot.fulfillment_type,
      deliveryAreaId: snapshot.delivery_area_id,
      deliveryAddress: snapshot.delivery_address?.trim() || null,
      deliveryCharge: snapshot.delivery_charge,
      subtotal: snapshot.subtotal,
      total: snapshot.total,
      status: "pending",
      paymentMethod: "razorpay",
      paymentStatus: "SUCCESS",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      deliveryDate,
    })
    .returning();

  const orderId = order!.id;

  for (const line of snapshot.lines) {
    await db.insert(orderItemsTable).values({
      orderId,
      productId: line.productId,
      snackId: line.snackId,
      quantity: line.quantity,
      price: line.price,
    });
  }

  const [cart] = await db
    .select()
    .from(cartTable)
    .where(and(eq(cartTable.userId, userId), eq(cartTable.status, 1)))
    .limit(1);
  if (cart) {
    await db.update(cartItemsTable).set({ status: 2 }).where(eq(cartItemsTable.cartId, cart.id));
  }

  await db
    .update(paymentsTable)
    .set({
      status: "paid",
      orderId,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(paymentsTable.id, payment.id));

  return orderId;
}

/**
 * Step 3 — Verify HMAC, create app order + items, clear cart, link payment row.
 */
export async function verifyRazorpayAndCreateOrder(
  userId: number,
  razorpay_order_id: string,
  razorpay_payment_id: string | undefined,
  razorpay_signature: string | undefined,
  failure?: { error_code?: string; error_description?: string },
): Promise<
  | { ok: true; order_id: number; already_processed?: boolean }
  | { ok: false; error: string; status: number; recorded_failure?: boolean }
> {
  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.razorpayOrderId, razorpay_order_id))
    .limit(1);

  if (!payment) {
    return { ok: false, error: "Payment record not found", status: 404 };
  }

  if (payment.userId !== userId) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  // Idempotent success
  if (payment.status === "paid" && payment.orderId != null) {
    return { ok: true, order_id: payment.orderId, already_processed: true };
  }

  // ── Failure path (modal dismissed, card declined, etc.) ───────────────────
  if (!razorpay_payment_id || !razorpay_signature) {
    await db
      .update(paymentsTable)
      .set({
        status: "failed",
        errorCode: failure?.error_code ?? "UNKNOWN",
        errorDescription: failure?.error_description ?? "Payment was not completed",
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, payment.id));

    return { ok: false, error: failure?.error_description ?? "Payment failed", status: 200, recorded_failure: true };
  }

  // ── Signature verification ─────────────────────────────────────────────────
  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    await db
      .update(paymentsTable)
      .set({
        status: "failed",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        errorCode: "SIGNATURE_MISMATCH",
        errorDescription: "Payment signature verification failed",
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, payment.id));

    return { ok: false, error: "Payment signature verification failed", status: 400 };
  }

  try {
    const orderId = await finalizeCheckoutFromSnapshotPayment(
      payment,
      userId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    );
    return { ok: true, order_id: orderId };
  } catch (e: any) {
    console.error("finalizeCheckoutFromSnapshotPayment:", e);
    return { ok: false, error: e?.message ?? "Could not complete order after payment", status: 500 };
  }
}
