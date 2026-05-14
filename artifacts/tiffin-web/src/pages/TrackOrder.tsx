import { useState } from "react";
import { Search, Package, CheckCircle, Clock, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { useTrackOrder, getTrackOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_STEPS = ["pending", "preparing", "ready", "on the way", "delivered"];
const STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  preparing: "Preparing",
  ready: "Ready",
  "on the way": "On the Way",
  delivered: "Delivered",
};

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useTrackOrder(searchId!, {
    query: { enabled: !!searchId, queryKey: getTrackOrderQueryKey(searchId!) }
  });

  const handleTrack = () => {
    const id = parseInt(orderId.trim(), 10);
    if (id > 0) {
      setSearchId(id);
      queryClient.invalidateQueries({ queryKey: getTrackOrderQueryKey(id) });
    }
  };

  const currentStep = order ? STATUS_STEPS.indexOf(order.status.toLowerCase()) : -1;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>Track Your Order</h1>
          <p className="text-muted-foreground">Enter your Order ID to see the real-time status</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-6 mb-8">
          <div className="flex gap-3">
            <Input
              placeholder="Enter Order ID (e.g. 12345)"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTrack()}
              className="flex-1"
              data-testid="input-order-id"
            />
            <Button
              onClick={handleTrack}
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={isLoading}
              data-testid="btn-track"
            >
              <Search className="w-4 h-4 mr-2" />
              Track
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground">Searching for your order...</div>
        )}

        {error && !isLoading && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl p-6 text-center" data-testid="order-not-found">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-60" />
            <p className="font-medium">Order not found</p>
            <p className="text-sm opacity-70 mt-1">Please check your Order ID and try again.</p>
          </div>
        )}

        {order && !isLoading && (
          <div className="space-y-6" data-testid="order-result">
            {/* Status */}
            <div className="bg-card border border-card-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-foreground">Order #{order.id}</h2>
                  <p className="text-sm text-muted-foreground">{new Date(order.order_time).toLocaleString("en-IN")}</p>
                </div>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  order.status === "delivered" ? "bg-green-100 text-green-700" :
                  order.status === "on the way" ? "bg-purple-100 text-purple-700" :
                  order.status === "ready" ? "bg-blue-100 text-blue-700" :
                  order.status === "preparing" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-700"
                }`} data-testid="text-order-status">
                  {STATUS_LABELS[order.status.toLowerCase()] || order.status}
                </span>
              </div>

              {/* Timeline */}
              <div className="flex items-center">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      i <= currentStep ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`} data-testid={`status-step-${step.replace(" ", "-")}`}>
                      {i < currentStep ? <CheckCircle className="w-4 h-4" /> :
                       i === currentStep ? (step === "on the way" ? <Truck className="w-4 h-4" /> : <Clock className="w-4 h-4" />) :
                       <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-1 mx-1 rounded ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className={`text-xs ${i <= currentStep ? "text-primary font-medium" : "text-muted-foreground"}`} style={{ width: i === STATUS_STEPS.length - 1 ? "auto" : "20%" }}>
                    {STATUS_LABELS[step]}
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="bg-card border border-card-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm" data-testid={`order-item-${item.id}`}>
                    <span className="text-foreground">{item.quantity}x {item.product_name}</span>
                    <span className="font-medium">&#x20B9;{(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-border flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary" data-testid="text-order-total">&#x20B9;{order.total}</span>
                </div>
              </div>
            </div>

            {order.delivery_date && (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 text-center">
                <p className="text-sm text-foreground">
                  Expected delivery: <span className="font-semibold text-primary">{new Date(order.delivery_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
                </p>
              </div>
            )}

            {order.fulfillment_type === "DELIVERY" && order.delivery_address && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-2">Delivery address</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.delivery_address}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
