import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth";
import { getRazorpayKeyId } from "../config/razorpay";
import { createRazorpayCheckout, verifyRazorpayAndCreateOrder } from "../services/paymentService";
import { eq } from "drizzle-orm";
import { db, ordersTable, paymentsTable } from "@workspace/db";
import type { FulfillmentType } from "../services/paymentService";

/**
 * POST /api/payment/create-order
 * Body: { delivery_area_id, delivery_address?, amount?, fulfillment_type? } — amount is total in paise (optional cross-check).
 */
export async function postCreateOrder(req: AuthRequest, res: Response): Promise<void> {
  const { delivery_area_id, delivery_address, amount, fulfillment_type } = req.body as {
    delivery_area_id?: number;
    delivery_address?: string;
    amount?: number;
    fulfillment_type?: FulfillmentType;
  };
  const selectedFulfillmentType: FulfillmentType = fulfillment_type ?? "DELIVERY";

  if (!["DELIVERY", "TAKE_AWAY", "DINE_IN"].includes(selectedFulfillmentType)) {
    res.status(400).json({ error: "fulfillment_type must be DELIVERY, TAKE_AWAY, or DINE_IN" });
    return;
  }

  if (selectedFulfillmentType === "DELIVERY" && (delivery_area_id == null || typeof delivery_area_id !== "number")) {
    res.status(400).json({ error: "delivery_area_id is required and must be a number for delivery orders" });
    return;
  }

  const result = await createRazorpayCheckout(
    req.user!.id,
    selectedFulfillmentType,
    delivery_area_id,
    delivery_address,
    amount,
  );

  if (!result.ok) {
    // `from: "api"` helps tell this JSON apart from an empty/HTML 502 from the Vite proxy when the API is unreachable.
    res.status(result.status).json({ error: result.error, from: "api", step: "create-order" });
    return;
  }

  res.json({
    order_id: result.razorpay_order_id,
    amount: result.amount,
    currency: result.currency,
    key_id: getRazorpayKeyId(),
  });
}

/**
 * POST /api/payment/verify
 * Success: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Failure: { razorpay_order_id, error_code?, error_description? }
 */
export async function postVerify(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    error_code?: string;
    error_description?: string;
  };

  if (!body.razorpay_order_id) {
    res.status(400).json({ error: "razorpay_order_id is required" });
    return;
  }

  const result = await verifyRazorpayAndCreateOrder(
    req.user!.id,
    body.razorpay_order_id,
    body.razorpay_payment_id,
    body.razorpay_signature,
    { error_code: body.error_code, error_description: body.error_description },
  );

  if (!result.ok) {
    if (result.recorded_failure) {
      res.status(200).json({ success: false, message: result.error });
      return;
    }
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    message: "Payment verified and order created",
    order_id: result.order_id,
    already_processed: result.already_processed ?? false,
  });
}

/**
 * GET /api/payment/order/:orderId — payment attempts for an app order (owner or admin).
 */
export async function getPaymentsForOrder(req: AuthRequest, res: Response): Promise<void> {
  const orderId = parseInt(req.params.orderId as string, 10);

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const isOwner = order.userId === req.user!.id;
  const isAdmin = req.user!.role === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.orderId, orderId));
  res.json(payments);
}
