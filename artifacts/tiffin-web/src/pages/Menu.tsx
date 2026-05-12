import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Package } from "lucide-react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { useListProducts, useListCategories, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMenuDateLabel(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function parseMenuDateFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const d = params.get("menu_date");
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

export default function Menu() {
  const routeSearch = useSearch();
  const menuDateFromUrl = useMemo(() => parseMenuDateFromSearch(routeSearch), [routeSearch]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedMenuDate, setSelectedMenuDate] = useState(() => menuDateFromUrl ?? todayIsoDate());

  useEffect(() => {
    if (menuDateFromUrl) setSelectedMenuDate(menuDateFromUrl);
  }, [menuDateFromUrl]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories } = useListCategories();
  const { data: products, isLoading } = useListProducts({
    category_id: selectedCategory,
    menu_date: selectedMenuDate,
    search: search || undefined,
  });

  const addToCart = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Added to cart!", description: "Item added successfully." });
      },
      onError: () => toast({ title: "Error", description: "Failed to add item.", variant: "destructive" }),
    }
  });

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    addToCart.mutate({ data: { product_id: productId, quantity: 1 } });
  };

  const filtered = products?.filter(p => {
    if (availableOnly && p.stock === 0) return false;
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="mb-6 sm:mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground sm:text-4xl" style={{ fontFamily: "Poppins, sans-serif" }}>Our Menu</h1>
          <p className="text-muted-foreground">Every item is prepared fresh daily — strictly no onion, garlic, or root vegetables.</p>
          <p className="text-sm text-primary font-medium mt-2">
            Showing menu for: {formatMenuDateLabel(selectedMenuDate)}
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search menu items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Button
            variant={availableOnly ? "default" : "outline"}
            onClick={() => setAvailableOnly(!availableOnly)}
            className={`${availableOnly ? "bg-primary text-white" : ""} w-full sm:w-auto`}
            data-testid="btn-available-only"
          >
            Available Only
          </Button>
     
            <Input
              id="menu-date"
              type="date"
              min={todayIsoDate()}
              value={selectedMenuDate}
              onChange={(e) => setSelectedMenuDate(e.target.value)}
              className="w-full"
              data-testid="input-menu-date"
            />
       
        </div>

        {/* Category Pills */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto whitespace-nowrap px-4 pb-1 sm:mx-0 sm:mb-8 sm:px-0">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${!selectedCategory ? "bg-primary text-white" : "bg-card border border-border text-foreground hover:bg-muted"}`}
            data-testid="category-all"
          >
            All Items {products && `(${products.length})`}
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${selectedCategory === cat.id ? "bg-primary text-white" : "bg-card border border-border text-foreground hover:bg-muted"}`}
              data-testid={`category-${cat.id}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Full Menu</h2>
          <span className="text-sm text-muted-foreground">{filtered.length} items</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-8 bg-muted rounded mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map(product => (
              <div key={product.id} className="bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow group" data-testid={`card-product-${product.id}`}>
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={product.image_url || `https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80`}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    data-testid={`img-product-${product.id}`}
                  />
                  {product.is_special && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      Today&apos;s Special
                    </span>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-destructive text-white text-sm font-semibold px-3 py-1 rounded-full">Out of Stock</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 text-sm" data-testid={`text-product-name-${product.id}`}>{product.name}</h3>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-primary whitespace-nowrap" data-testid={`text-price-${product.id}`}>&#x20B9;{product.price}</span>
                    <Button
                      size="sm"
                      className="h-8 min-w-0 bg-primary px-3 text-xs text-white hover:bg-primary/90"
                      disabled={product.stock === 0 || addToCart.isPending}
                      onClick={() => handleAddToCart(product.id)}
                      data-testid={`btn-add-to-cart-${product.id}`}
                    >
                      <ShoppingCart className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">Add to Cart</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
            <p className="text-muted-foreground">Try a different search or category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
