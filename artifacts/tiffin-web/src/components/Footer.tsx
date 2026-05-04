import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Leaf, Phone, MapPin, Clock, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useGetSettings } from "@workspace/api-client-react";

const ADDRESS = "Jain Bhavan, Sector-12, Kharghar, Navi Mumbai";

const QUICK_LINKS = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Our Menu" },
  { to: "/snacks", label: "Snacks Store" },
  { to: "/contact", label: "Bulk Orders" },
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact Us" },
  { to: "/track-order", label: "Track Order" },
] as const;

const SERVICES = [
  "Daily Tiffin Delivery",
  "Monthly Subscription",
  "Office Lunch Catering",
  "Wedding Catering",
  "Religious Event Catering",
  "Dry Snacks — Khakhra, Namkeen",
  "Festival Special Thali",
] as const;

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function formatCutoffTime(raw?: string | null) {
  if (!raw) return "6:30 PM";
  const part = raw.slice(0, 5);
  const [h, m] = part.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return raw;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.984-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function Footer() {
  const { data: settings } = useGetSettings();
  const footerRef = useRef<HTMLElement | null>(null);
  const phoneDisplay = settings?.contact_number?.trim() || "+91 9186908 57887";
  const waDigits = digitsOnly(phoneDisplay);
  const waHref = waDigits ? `https://wa.me/${waDigits.startsWith("91") ? waDigits : `91${waDigits}`}` : "https://wa.me/918690857887";
  const telHref = `tel:${digitsOnly(phoneDisplay) || "918690857887"}`;
  const cutoff = formatCutoffTime(settings?.order_cutoff_time);
  useEffect(() => {
    if (!footerRef.current) return;
    const target = footerRef.current;
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target as HTMLElement;
          if (!node.classList.contains("animated")) {
            node.classList.add("animated");
          }
          obs.unobserve(node);
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className="bg-[#2c1810] text-white/90 footer-scroll-anim" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <BrandLogo className="h-12 w-12 shadow-md ring-2 ring-white/20" />
              <div>
                <div className="font-bold text-lg text-primary leading-tight group-hover:text-primary/90" style={{ fontFamily: "Poppins, sans-serif" }}>
                  Saatvik Jain
                </div>
                <div className="text-sm text-white/80">Aahar Gruh</div>
              </div>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Pure Jain home-style meals — no onion, no garlic, no root vegetables. Freshly cooked every day and delivered with love.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg text-white flex items-center justify-center footer-social-icon footer-social-whatsapp"
                aria-label="WhatsApp"
              >
                <WhatsAppGlyph className="w-5 h-5" />
              </a>
              <a
                href={telHref}
                className="w-10 h-10 rounded-lg text-white flex items-center justify-center footer-social-icon footer-social-phone"
                aria-label="Call us"
              >
                <Phone className="w-5 h-5" />
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg text-white flex items-center justify-center footer-social-icon footer-social-instagram"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg text-white flex items-center justify-center footer-social-icon footer-social-facebook"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white/90 uppercase mb-4">Quick links</h3>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <Link
                    to={item.to}
                    className="text-sm text-white/65 hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white/90 uppercase mb-4">Our services</h3>
            <ul className="space-y-2.5">
              {SERVICES.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-white/65">
                  <Leaf className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white/90 uppercase mb-4">Contact &amp; hours</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 text-white/80">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <a href={telHref} className="hover:text-primary transition-colors">
                  {phoneDisplay}
                </a>
              </li>
              <li className="flex gap-3 text-white/80">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>{ADDRESS}</span>
              </li>
              <li className="flex gap-3 text-white/80">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div>Lunch: 9 AM – 1 PM</div>
                  <div>Nasta: 3 PM – 5 PM</div>
                  <div>Dinner: 4 PM – 6:30 PM</div>
                  <div className="text-xs text-white/50 mt-1">Order cutoff: {cutoff}</div>
                </div>
              </li>
            </ul>
            <Button
              asChild
              className="mt-6 w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium rounded-xl pulse-cta"
            >
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2">
                <WhatsAppGlyph className="w-5 h-5" />
                WhatsApp us
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-white/45">
          <p>© 2026 Saatvik Jain Aahar Gruh. All rights reserved.</p>
          <p className="flex items-center gap-2 text-white/55">
            <Leaf className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <span>100% Pure Jain · No onion · No garlic · No roots</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
