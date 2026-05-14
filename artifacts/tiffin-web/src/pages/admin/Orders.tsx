import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminListOrders, useUpdateOrderStatus, getAdminListOrdersQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["pending", "preparing", "ready", "on the way", "delivered"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  preparing: "bg-blue-100 text-blue-700 border-blue-200",
  ready: "bg-green-100 text-green-700 border-green-200",
  "on the way": "bg-purple-100 text-purple-700 border-purple-200",
  delivered: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function Orders() {
  const [filter, setFilter] = useState<string | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useAdminListOrders(filter ? { status: filter } : {}, {
    query: { queryKey: getAdminListOrdersQueryKey(filter ? { status: filter } : {}) }
  });

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
        toast({ title: "Status updated" });
      },
    }
  });

  const filterTabs = ["All Orders", ...STATUSES.map(s => s.charAt(0).toUpperCase() + s.slice(1))];

  return (
    <AdminLayout>
      <div data-testid="admin-orders">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Poppins, sans-serif" }}>Orders</h1>
          <p className="text-sm text-muted-foreground">Manage and track all orders</p>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-1 mb-6">
          {filterTabs.map((tab, i) => {
            const val = i === 0 ? undefined : STATUSES[i - 1];
            const isActive = filter === val;
            return (
              <button
                key={tab}
                onClick={() => setFilter(val)}
                className={`shrink-0 min-h-9 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? "bg-primary text-white" : "bg-card border border-border text-foreground hover:bg-muted"}`}
                data-testid={`filter-${tab.toLowerCase().replace(" ", "-")}`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{orders?.length ?? 0} Orders</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Order ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Area</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground min-w-[12rem] max-w-xs">Delivery address</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Items</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Payment</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.map(order => (
                    <tr key={order.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-order-${order.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">ORD{String(order.id).padStart(8, "0")}</div>
                        <div className="text-xs text-muted-foreground">{new Date(order.order_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{order.customer_name || "Guest"}</div>
                        <div className="text-xs text-muted-foreground">{order.customer_phone || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{order.delivery_area_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground align-top max-w-xs">
                        <span className="whitespace-pre-wrap break-words line-clamp-4" title={order.delivery_address || undefined}>
                          {order.fulfillment_type === "DELIVERY" ? order.delivery_address || "—" : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {order.items.slice(0, 2).map((item: any) => `${item.quantity}x ${item.product_name}`).join(", ")}
                        {order.items.length > 2 && ` +${order.items.length - 2} more`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{order.payment_method || "COD"}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">&#x20B9;{order.total}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Select
                          value={order.status}
                          onValueChange={val => updateStatus.mutate({ id: order.id, data: { status: val } })}
                        >
                          <SelectTrigger className={`h-8 text-xs font-semibold border w-[8.5rem] sm:w-36 ${STATUS_COLORS[order.status] || ""}`} data-testid={`select-status-${order.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orders?.length && (
                <div className="p-12 text-center text-muted-foreground">No orders found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
