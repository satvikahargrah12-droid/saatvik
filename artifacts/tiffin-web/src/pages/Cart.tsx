import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Loader2, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Navbar } from "@/components/Navbar";
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useCreateOrder,
  useListDeliveryAreas,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as string;
const API_BASE = (import.meta.env.VITE_API_SERVER_URL ?? "").replace(/\/+$/, "");

type CheckoutStep = 1 | 2 | 3;
type FulfillmentType = "DELIVERY" | "TAKE_AWAY" | "DINE_IN";

/** Backend response from POST /api/payment/create-order */
interface CreatePaymentOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

/** Backend response from POST /api/payment/verify */
interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  order_id?: number;
  error?: string;
}

async function apiPostJson<T>(path: string, body: unknown, token: string): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

export default function Cart() {
  const { isAuthenticated, user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentUiError, setPaymentUiError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useGetCart({
    query: { enabled: isAuthenticated, queryKey: getGetCartQueryKey() },
  });
  const { data: areas } = useListDeliveryAreas();

  const updateItem = useUpdateCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });
  const removeItem = useRemoveCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });

  const isDeliveryOrder = fulfillmentType === "DELIVERY";
  const deliveryAddressOk = !isDeliveryOrder || deliveryAddress.trim().length >= 5;
  const selectedAreaData = areas?.find((a) => a.id.toString() === selectedArea);
  const deliveryCharge = isDeliveryOrder && selectedAreaData ? parseFloat(selectedAreaData.delivery_charge as string) : 0;
  const subtotal = parseFloat(cart?.subtotal || "0");
  const total = subtotal + deliveryCharge;
  const amountPaise = Math.round(total * 100);
  const isEmpty = !cart?.items || cart.items.length === 0;
  const isCheckoutBusy = isProcessingPayment;

  const openRazorpayCheckout = useCallback(
    (rzpOrderRes: CreatePaymentOrderResponse) => {
      if (!window.Razorpay) {
        toast({
          title: "Payment unavailable",
          description: "Razorpay could not be loaded. Please try again.",
          variant: "destructive",
        });
        setIsProcessingPayment(false);
        return;
      }

      const options: RazorpayOptions = {
        key: RAZORPAY_KEY_ID || rzpOrderRes.key_id,
        amount: rzpOrderRes.amount,
        currency: rzpOrderRes.currency,
        name: "Saatvik Jain Aahar Gruh",
        description: "Secure checkout",
        order_id: rzpOrderRes.order_id,

        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined,
        },

        theme: { color: "#f97316" },

        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const { ok, data } = await apiPostJson<VerifyPaymentResponse>(
              "/payment/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              token!,
            );

            if (!ok || data.error) {
              throw new Error((data as VerifyPaymentResponse).error ?? "Verification failed");
            }
            if (data.success === false) {
              throw new Error(data.message ?? "Payment was not completed");
            }

            queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
            setPaymentUiError(null);
            toast({
              title: "Order placed",
              description: `Payment successful. Order #${data.order_id} is confirmed.`,
            });
            setLocation("/track-order");
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Verification failed";
            setPaymentUiError(msg);
            toast({
              title: "Payment verification failed",
              description: msg,
              variant: "destructive",
            });
          } finally {
            setIsProcessingPayment(false);
          }
        },

        modal: {
          ondismiss: async () => {
            try {
              const { data } = await apiPostJson<VerifyPaymentResponse>(
                "/payment/verify",
                {
                  razorpay_order_id: rzpOrderRes.order_id,
                  error_code: "PAYMENT_CANCELLED",
                  error_description: "User closed the payment modal",
                },
                token!,
              );
              if (data.success === false) {
                setPaymentUiError(data.message ?? "Payment cancelled");
              }
            } catch {
              setPaymentUiError("Could not record cancellation — you can retry payment.");
            }
            toast({
              title: "Payment cancelled",
              description: "You can try again when you are ready.",
              variant: "destructive",
            });
            setIsProcessingPayment(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", async (response: { error?: { code?: string; description?: string } }) => {
        try {
          const { data } = await apiPostJson<VerifyPaymentResponse>(
            "/payment/verify",
            {
              razorpay_order_id: rzpOrderRes.order_id,
              error_code: response.error?.code ?? "PAYMENT_FAILED",
              error_description: response.error?.description ?? "Payment failed",
            },
            token!,
          );
          setPaymentUiError(data.message ?? response.error?.description ?? "Payment failed");
        } catch {
          setPaymentUiError("Payment failed — please retry.");
        }
        toast({
          title: "Payment failed",
          description: response.error?.description ?? "Please try again or use another method.",
          variant: "destructive",
        });
        setIsProcessingPayment(false);
      });

      rzp.open();
    },
    [user, token, queryClient, toast, setLocation],
  );

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: async (order) => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Order placed!", description: `Order #${order.id} confirmed.` });
        setLocation("/track-order");
        setIsProcessingPayment(false);
      },
      onError: (err: { data?: { error?: string } }) => {
        toast({
          title: "Order failed",
          description: err?.data?.error ?? "Please try again.",
          variant: "destructive",
        });
        setIsProcessingPayment(false);
      },
    },
  });

  /** Razorpay: server creates Razorpay order from cart; app order is created only after /payment/verify succeeds. */
  async function handleRazorpayPayNow() {
    if ((isDeliveryOrder && (!selectedArea || !deliveryAddressOk)) || !token) return;
    setPaymentUiError(null);
    setIsProcessingPayment(true);
    try {
      const { ok, status, data } = await apiPostJson<CreatePaymentOrderResponse & { error?: string }>(
        "/payment/create-order",
        {
          fulfillment_type: fulfillmentType,
          delivery_area_id: isDeliveryOrder ? parseInt(selectedArea, 10) : undefined,
          delivery_address: isDeliveryOrder ? deliveryAddress.trim() : undefined,
          amount: amountPaise,
        },
        token,
      );
      if (!ok) {
        const msg = (data as { error?: string }).error ?? `Request failed (${status})`;
        throw new Error(msg);
      }
      openRazorpayCheckout(data as CreatePaymentOrderResponse);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error — check your connection and retry.";
      setPaymentUiError(msg);
      toast({ title: "Could not start payment", description: msg, variant: "destructive" });
      setIsProcessingPayment(false);
    }
  }

  function handleCodCheckout() {
    if (isDeliveryOrder && (!selectedArea || !deliveryAddressOk)) return;
    setIsProcessingPayment(true);
    createOrder.mutate({
      data: {
        fulfillment_type: fulfillmentType,
        delivery_area_id: isDeliveryOrder ? parseInt(selectedArea, 10) : undefined,
        delivery_address: isDeliveryOrder ? deliveryAddress.trim() : undefined,
        payment_method: paymentMethod,
      },
    });
  }

  function goNext() {
    if (checkoutStep === 1 && isDeliveryOrder && (!selectedArea || !deliveryAddressOk)) return;
    setCheckoutStep((s) => (s < 3 ? ((s + 1) as CheckoutStep) : s));
  }
  function goBack() {
    setCheckoutStep((s) => (s > 1 ? ((s - 1) as CheckoutStep) : s));
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShoppingCart className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Please login to view your cart</h2>
          <Link to="/login">
            <Button className="bg-primary text-white">Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-8" style={{ fontFamily: "Poppins, sans-serif" }}>
          Your Cart
        </h1>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" data-testid="cart-empty">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
              <ShoppingCart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Your cart is empty</h2>
            <p className="text-muted-foreground">Add some delicious items to get started!</p>
            <Link to="/menu">
              <Button className="bg-primary text-white" data-testid="btn-browse-menu">
                Browse Menu
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {cart.items.map((item: any) => (
                <div
                  key={item.id}
                  className="bg-card border border-card-border rounded-2xl p-4 flex gap-4"
                  data-testid={`cart-item-${item.id}`}
                >
                  <img
                    src={
                      item.product?.image_url ||
                      item.snack?.imageUrl ||
                      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&q=80"
                    }
                    alt={item.product?.name || item.snack?.name}
                    className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm" data-testid={`text-cart-item-name-${item.id}`}>
                      {item.product?.name || item.snack?.name}
                    </h3>
                    <p className="text-primary font-bold">&#x20B9;{item.product?.price || item.snack?.price}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: item.quantity - 1 } })}
                        data-testid={`btn-decrease-${item.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-semibold" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() => updateItem.mutate({ itemId: item.id, data: { quantity: item.quantity + 1 } })}
                        data-testid={`btn-increase-${item.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-destructive hover:text-destructive/80 transition-colors"
                        onClick={() => removeItem.mutate({ itemId: item.id })}
                        data-testid={`btn-remove-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-5 h-fit space-y-5" data-testid="order-summary">
              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
                {[
                  { n: 1 as CheckoutStep, label: "Fulfilment" },
                  { n: 2 as CheckoutStep, label: "Summary" },
                  { n: 3 as CheckoutStep, label: "Payment" },
                ].map(({ n, label }) => (
                  <div key={n} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        checkoutStep === n
                          ? "bg-primary text-white"
                          : checkoutStep > n
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {checkoutStep > n ? <CheckCircle2 className="w-4 h-4" /> : n}
                    </div>
                    <span className={checkoutStep === n ? "text-foreground" : ""}>{label}</span>
                  </div>
                ))}
              </div>

              {checkoutStep === 1 && (
                <div>
                  <h2 className="font-semibold text-foreground mb-3">Order type</h2>
                  <p className="text-sm text-muted-foreground mb-3">Choose how you want to receive the order.</p>
                  <Select
                    value={fulfillmentType}
                    onValueChange={(value: FulfillmentType) => {
                      setFulfillmentType(value);
                      if (value !== "DELIVERY") setDeliveryAddress("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELIVERY">Delivery</SelectItem>
                      <SelectItem value="TAKE_AWAY">Take Away</SelectItem>
                      <SelectItem value="DINE_IN">Dine In</SelectItem>
                    </SelectContent>
                  </Select>
                  {isDeliveryOrder ? (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-foreground mb-2 block">Delivery area</label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select area..." />
                        </SelectTrigger>
                        <SelectContent>
                          {areas?.map((area) => (
                            <SelectItem key={area.id} value={area.id.toString()} data-testid={`option-area-${area.id}`}>
                              {area.name} (+&#x20B9;{area.delivery_charge})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-4">
                        <label htmlFor="delivery-address" className="text-sm font-medium text-foreground mb-2 block">
                          Full delivery address
                        </label>
                        <Textarea
                          id="delivery-address"
                          placeholder="House / flat no., street, landmark, pincode…"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          rows={4}
                          className="resize-y min-h-[96px]"
                          data-testid="input-delivery-address"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Required for delivery (at least 5 characters). Our team uses this to reach you.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No delivery charge will be applied for {fulfillmentType === "TAKE_AWAY" ? "Take Away" : "Dine In"} orders.
                    </p>
                  )}
                </div>
              )}

              {checkoutStep === 2 && (
                <div>
                  <h2 className="font-semibold text-foreground mb-3">Order summary</h2>
                  <ul className="text-sm space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 mb-3">
                    {cart.items.map((item: any) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="text-muted-foreground truncate">
                          {item.product?.name || item.snack?.name} × {item.quantity}
                        </span>
                        <span className="shrink-0 font-medium">
                          &#x20B9;
                          {(parseFloat(item.product?.price || item.snack?.price || "0") * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>&#x20B9;{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>&#x20B9;{deliveryCharge.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary" data-testid="text-total">
                        &#x20B9;{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {checkoutStep === 3 && (
                <div>
                  <h2 className="font-semibold text-foreground mb-3">Payment</h2>
                  
                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-1.5 block">Payment method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COD">Cash on Delivery</SelectItem>
                        <SelectItem value="razorpay">
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4" />
                            Razorpay (card / UPI / netbanking)
                          </span>
                        </SelectItem>
                        <SelectItem value="GPay">GPay / UPI (recorded as offline)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentMethod === "razorpay" && (
                    <div className="mb-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      <CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Amount due: &#x20B9;{total.toFixed(2)} — you will confirm payment in the Razorpay window.</span>
                    </div>
                  )}
                  {paymentUiError && (
                    <div
                      className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3"
                      role="alert"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Payment issue</p>
                        <p className="opacity-90">{paymentUiError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                {checkoutStep > 1 ? (
                  <Button type="button" variant="outline" className="flex-1" onClick={goBack} disabled={isCheckoutBusy}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                ) : (
                  <div className="flex-1" />
                )}
                {checkoutStep < 3 ? (
                  <Button
                    type="button"
                    className="flex-1 bg-primary text-white"
                    onClick={goNext}
                    disabled={checkoutStep === 1 && isDeliveryOrder && (!selectedArea || !deliveryAddressOk)}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : paymentMethod === "razorpay" ? (
                  <Button
                    type="button"
                    className="flex-1 bg-primary text-white"
                    disabled={(isDeliveryOrder && (!selectedArea || !deliveryAddressOk)) || isCheckoutBusy}
                    onClick={handleRazorpayPayNow}
                    data-testid="btn-checkout"
                  >
                    {isCheckoutBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay now
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="flex-1 bg-primary text-white"
                    disabled={(isDeliveryOrder && (!selectedArea || !deliveryAddressOk)) || isCheckoutBusy || createOrder.isPending}
                    onClick={handleCodCheckout}
                    data-testid="btn-checkout"
                  >
                    {createOrder.isPending || isCheckoutBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Placing order…
                      </>
                    ) : (
                      "Place order"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
