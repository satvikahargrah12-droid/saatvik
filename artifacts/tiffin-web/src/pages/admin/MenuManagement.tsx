import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useToggleProductStatus, useAdminListCategories, getAdminListProductsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMenuDateLabel(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const WHATSAPP_PREFILL_MAX_CHARS = 9500;

function orderSiteBase(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return typeof window !== "undefined" ? window.location.origin : "";
}

function publicMenuOrderUrl(menuDate: string): string {
  return `${orderSiteBase()}/menu   `;
}

type WhatsAppShareItem = {
  name: string;
  description?: string | null;
  price: string;
  category_name?: string | null;
  status?: number;
  is_special?: boolean;
};

function normalizeShareDescription(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  return raw.replace(/\s+/g, " ").trim();
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function formatItemBlockForWhatsApp(p: WhatsAppShareItem, opts: { noteInactive?: boolean }): string {
  const cat = p.category_name ? ` (${p.category_name})` : "";
  let line = `• ${p.name}${cat} — ₹${p.price}`;
  if (p.is_special) line += " ⭐";
  if (opts.noteInactive && p.status === 0) line += " [Inactive]";
  const desc = normalizeShareDescription(p.description);
  if (desc) line += `\n  ${desc}`;
  return line;
}

function buildMenuWhatsAppText(menuDate: string, items: WhatsAppShareItem[]): string {
  const header = `🍽 Full menu — ${formatMenuDateLabel(menuDate)}\n\n`;
  const orderUrl = publicMenuOrderUrl(menuDate);
  const footer = `\n\nOrder here:\n${orderUrl}`;

  let body = items.map((p) => formatItemBlockForWhatsApp(p, { noteInactive: true })).join("\n\n");
  let total = header.length + body.length + footer.length;
  if (total <= WHATSAPP_PREFILL_MAX_CHARS) return header + body + footer;

  for (const cap of [120, 80, 50, 0]) {
    const nextBlocks = items.map((p) => {
      if (cap === 0) return formatItemBlockForWhatsApp({ ...p, description: null }, { noteInactive: true });
      const d = normalizeShareDescription(p.description);
      const shortened = d ? truncateText(d, cap) : "";
      return formatItemBlockForWhatsApp({ ...p, description: shortened || null }, { noteInactive: true });
    });
    body = nextBlocks.join("\n\n");
    total = header.length + body.length + footer.length;
    if (total <= WHATSAPP_PREFILL_MAX_CHARS) return header + body + footer;
  }

  const budget = WHATSAPP_PREFILL_MAX_CHARS - header.length - footer.length - 4;
  body = body.slice(0, Math.max(0, budget)).trimEnd() + "\n…";
  return header + body + footer;
}

function buildSingleItemWhatsAppText(menuDate: string, p: WhatsAppShareItem): string {
  const cat = p.category_name ? `\nCategory: ${p.category_name}` : "";
  const priceLine = `Price: ₹${p.price}`;
  const dateLine = `Menu day: ${formatMenuDateLabel(menuDate)}`;
  const flags = [
    p.is_special ? "⭐ Today's special" : "",
    p.status === 0 ? "Note: marked inactive in admin (may not show on site)." : "",
  ]
    .filter(Boolean)
    .join("\n");
  const desc = normalizeShareDescription(p.description);
  const descBlock = desc ? `\n\n${desc}` : "";
  const order = `\n\nOrder here:\n${publicMenuOrderUrl(menuDate)}`;

  let text = `🍽 ${p.name}${cat}\n${priceLine}\n${dateLine}`;
  if (flags) text += `\n${flags}`;
  text += descBlock + order;

  if (text.length <= WHATSAPP_PREFILL_MAX_CHARS) return text;
  const head = `🍽 ${p.name}${cat}\n${priceLine}\n${dateLine}${flags ? `\n${flags}` : ""}\n\n`;
  const tail = order;
  const descBudget = Math.max(0, WHATSAPP_PREFILL_MAX_CHARS - head.length - tail.length - 2);
  const shortDesc = desc && descBudget > 0 ? truncateText(desc, Math.max(1, descBudget)) : "";
  return `${head}${shortDesc}${tail}`;
}

function openWhatsAppPrefill(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

const productSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price required"),
  image_url: z.string().optional(),
  category_id: z.string().optional(),
  menu_date: z.string().min(1, "Menu date is required"),
  is_special: z.boolean().default(false),
  stock: z.coerce.number().min(0),
  status: z.coerce.number().default(1),
});
type ProductFormData = z.infer<typeof productSchema>;

export default function MenuManagement() {
  const [selectedMenuDate, setSelectedMenuDate] = useState(todayIsoDate());
  const { data: products, isLoading } = useAdminListProducts({ menu_date: selectedMenuDate });
  const { data: categories } = useAdminListCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editProduct, setEditProduct] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: "", image_url: "", category_id: "", menu_date: todayIsoDate(), is_special: false, stock: 0, status: 1 },
  });

  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() }); setShowModal(false); form.reset(); toast({ title: "Product created" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    }
  });

  const updateProduct = useUpdateProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() }); setShowModal(false); setEditProduct(null); form.reset(); toast({ title: "Product updated" }); },
    }
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() }); toast({ title: "Product deleted" }); },
    }
  });

  const toggleStatus = useToggleProductStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() }),
    }
  });

  const handleOpenModal = (product?: any) => {
    if (product) {
      setEditProduct(product);
      form.reset({
        name: product.name,
        description: product.description || "",
        price: product.price,
        image_url: product.image_url || "",
        category_id: product.category_id?.toString() || "",
        menu_date: product.menu_date?.slice(0, 10) || todayIsoDate(),
        is_special: product.is_special,
        stock: product.stock,
        status: product.status,
      });
    } else {
      setEditProduct(null);
      form.reset({ name: "", description: "", price: "", image_url: "", category_id: "", menu_date: selectedMenuDate, is_special: false, stock: 0, status: 1 });
    }
    setShowModal(true);
  };

  const handleSubmit = (data: ProductFormData) => {
    const payload = { ...data, category_id: data.category_id ? parseInt(data.category_id) : undefined };
    if (editProduct) {
      updateProduct.mutate({ id: editProduct.id, data: payload });
    } else {
      createProduct.mutate({ data: payload });
    }
  };

  const handleShareFullMenuWhatsApp = () => {
    const list = products ?? [];
    if (list.length === 0) {
      toast({
        title: "Nothing to share",
        description: "Add menu items for this date first.",
        variant: "destructive",
      });
      return;
    }
    const text = buildMenuWhatsAppText(selectedMenuDate, list);
    openWhatsAppPrefill(text);
  };

  const handleShareItemWhatsApp = (product: WhatsAppShareItem & { id: number }) => {
    const text = buildSingleItemWhatsAppText(selectedMenuDate, product);
    openWhatsAppPrefill(text);
  };

  return (
    <AdminLayout>
      <div data-testid="admin-menu">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Poppins, sans-serif" }}>Menu Management</h1>
            <p className="text-sm text-muted-foreground">Manage daily menu items and availability</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full sm:w-auto">
              <label htmlFor="admin-menu-date" className="text-sm text-muted-foreground sm:whitespace-nowrap">Menu date</label>
              <Input
                id="admin-menu-date"
                type="date"
                min={todayIsoDate()}
                value={selectedMenuDate}
                onChange={(e) => setSelectedMenuDate(e.target.value)}
                className="w-full sm:w-[180px]"
                data-testid="input-admin-menu-date"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-[#25D366] text-[#128C7E] hover:bg-[#25D366]/10"
              onClick={handleShareFullMenuWhatsApp}
              disabled={isLoading || !products?.length}
              data-testid="btn-share-menu-whatsapp"
              title="Share every item for this menu date (with descriptions)"
            >
              <SiWhatsapp className="w-4 h-4 mr-2 shrink-0 text-[#25D366]" />
              Share full menu
            </Button>
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white" onClick={() => handleOpenModal()} data-testid="btn-add-product">
              <Plus className="w-4 h-4 mr-2" /> Add New Item
            </Button>
          </div>
        </div>
        <p className="text-sm text-primary mb-4">Showing items for: {formatMenuDateLabel(selectedMenuDate)}</p>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">All Menu Items</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Item Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Menu Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Stock</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products?.map(product => (
                    <tr key={product.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-product-${product.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{product.name}</div>
                        {product.is_special && <span className="text-xs text-green-600 font-medium">Today's Special</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{product.category_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatMenuDateLabel(product.menu_date.slice(0, 10))}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">&#x20B9;{product.price}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{product.stock} units</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Switch
                          checked={product.status === 1}
                          onCheckedChange={() => toggleStatus.mutate({ id: product.id })}
                          data-testid={`toggle-product-${product.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#128C7E] hover:text-[#075E54] hover:bg-[#25D366]/15"
                            onClick={() => handleShareItemWhatsApp(product)}
                            title="Share this item on WhatsApp (with description)"
                            data-testid={`btn-whatsapp-product-${product.id}`}
                          >
                            <SiWhatsapp className="w-4 h-4 text-[#25D366]" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80" onClick={() => handleOpenModal(product)} data-testid={`btn-edit-product-${product.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={() => deleteProduct.mutate({ id: product.id })} data-testid={`btn-delete-product-${product.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editProduct ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-product-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} data-testid="input-product-price" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-product-stock" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="menu_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menu Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          min={todayIsoDate()}
                          {...field}
                          data-testid="input-product-menu-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value?.toString()} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="1">Active</SelectItem>
                          <SelectItem value="0">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea className="resize-none h-20" {...field} data-testid="input-product-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="image_url" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Image URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} data-testid="input-product-image" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="is_special" render={({ field }) => (
                    <FormItem className="flex items-center gap-2 col-span-2">
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="toggle-is-special" /></FormControl>
                      <FormLabel className="!mt-0">Today's Special</FormLabel>
                    </FormItem>
                  )} />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" className="w-full sm:w-auto bg-primary text-white" disabled={createProduct.isPending || updateProduct.isPending} data-testid="btn-save-product">
                    {createProduct.isPending || updateProduct.isPending ? "Saving..." : "Save Item"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
