import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Clock, Star, Leaf, ChefHat, Heart, Images, Cookie, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useGetSettings } from "@workspace/api-client-react";

function parseCutoffHourMinute(raw?: string | null): { hour: number; minute: number } {
  if (!raw) return { hour: 18, minute: 30 };
  const [h, m] = raw.slice(0, 5).split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour: 18, minute: 30 };
  return { hour: h, minute: m };
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const [now, setNow] = useState(() => new Date());
  const statsStartedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const cutoffParts = useMemo(
    () => parseCutoffHourMinute(settings?.order_cutoff_time),
    [settings?.order_cutoff_time],
  );

  const cutoffLabel = useMemo(() => {
    const d = new Date();
    d.setHours(cutoffParts.hour, cutoffParts.minute, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [cutoffParts.hour, cutoffParts.minute]);

  const isOrderOpen = useMemo(() => {
    const cutoff = new Date(now);
    cutoff.setHours(cutoffParts.hour, cutoffParts.minute, 0, 0);
    return now <= cutoff;
  }, [now, cutoffParts.hour, cutoffParts.minute]);

  const bannerMessage = isOrderOpen
    ? `Orders open today until ${cutoffLabel} - Order now for fresh Jain meals!`
    : `Today's orders are closed (cut-off: ${cutoffLabel}). You can place your order for tomorrow.`;
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setHeroLoaded(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const countUp = (el: HTMLElement, target: number, duration: number, suffix: string) => {
      let value = 0;
      const stepMs = 16;
      const increment = Math.max(1, Math.ceil((target * stepMs) / duration));
      const timer = window.setInterval(() => {
        value += increment;
        if (value >= target) {
          value = target;
          el.textContent = `${value}${suffix}`;
          window.clearInterval(timer);
          return;
        }
        el.textContent = `${value}`;
      }, stepMs);
    };

    const runStatsCounter = (container: HTMLElement) => {
      if (statsStartedRef.current) return;
      statsStartedRef.current = true;
      const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-counter-target]"));
      nodes.forEach((node) => {
        const target = Number(node.dataset.counterTarget ?? "0");
        const duration = Number(node.dataset.counterDuration ?? "1000");
        const suffix = node.dataset.counterSuffix ?? "";
        countUp(node, target, duration, suffix);
      });
    };

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          if (element.classList.contains("animated")) {
            obs.unobserve(element);
            return;
          }
          element.classList.add("animated");
          if (element.dataset.counterGroup === "stats") {
            runStatsCounter(element);
          }
          obs.unobserve(element);
        });
      },
      { threshold: 0.15 },
    );

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-animate-on-scroll]"));
    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Announcement Banner */}
      <div
        className={`text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2 ${
          isOrderOpen ? "bg-green-600" : "bg-red-600"
        }`}
        data-testid="announcement-banner"
      >
          <Clock className="w-4 h-4" />
          <span>{bannerMessage}</span>
        </div>

      {/* Hero Section */}
      <section
        className="relative min-h-[80vh] flex items-center"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.75) 40%, rgba(0,0,0,0.2) 100%), url('https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1400&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        data-testid="hero-section"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-xl">
            <div className={`inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-4 py-2 rounded-full mb-6 home-load-anim from-top delay-0 ${heroLoaded ? "animated" : ""}`}>
              <Leaf className="w-3.5 h-3.5 text-green-400" />
              Pure Jain · No Onion · No Garlic
            </div>
            <div className={`home-load-anim from-left delay-150 ${heroLoaded ? "animated" : ""}`}>
              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>
                Saatvik Jain
              </h1>
              <h2 className="text-4xl lg:text-5xl font-bold text-primary mb-6" style={{ fontFamily: "Poppins, sans-serif" }}>
                Aahar Gruh
              </h2>
            </div>
            <p className={`text-lg text-white/80 mb-8 leading-relaxed home-load-anim from-bottom delay-300 ${heroLoaded ? "animated" : ""}`}>
              Authentic, home-style Jain meals — freshly cooked and delivered to your doorstep every day. No fuss. Just wholesome food.
            </p>
            <div className={`flex flex-wrap gap-4 mb-12 home-load-anim from-bottom delay-450 ${heroLoaded ? "animated" : ""}`}>
              <Link to="/menu">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 home-hero-btn" data-testid="btn-order-now">
                  Order Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/menu">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 bg-transparent home-hero-btn" data-testid="btn-view-menu">
                  View Menu
                </Button>
              </Link>
            </div>
            <div className="flex gap-8 scroll-anim from-bottom" data-animate-on-scroll data-counter-group="stats">
              {[
                { value: 500, duration: 1400, suffix: "+", label: "Happy Families" },
                { value: 6, duration: 900, suffix: "+", label: "Years of Service" },
                { value: 100, duration: 1200, suffix: "%", label: "Jain Certified" },
              ].map((stat) => (
                <div key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>
                  <div
                    className="text-2xl font-bold text-primary"
                    data-counter-target={stat.value}
                    data-counter-duration={stat.duration}
                    data-counter-suffix={stat.suffix}
                  >
                    0
                  </div>
                  <div className="text-xs text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">WHY CHOOSE US</div>
            <h2 className="text-4xl font-bold text-foreground" style={{ fontFamily: "Poppins, sans-serif" }}>Pure Food. Pure Values.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Leaf, title: "100% Jain Food", desc: "No onion, no garlic, no root vegetables. Pure Jain recipes prepared with love and tradition." },
              { icon: ChefHat, title: "Home-Style Cooking", desc: "Every meal is freshly prepared each day using traditional Jain recipes passed down for generations." },
              { icon: Heart, title: "Delivered With Care", desc: "Hot, fresh meals delivered to your doorstep. Because every family deserves nutritious, authentic food." },
            ].map((item, index) => (
              <div
                key={item.title}
                className="bg-card border border-card-border rounded-2xl p-6 text-center home-feature-card scroll-anim from-bottom"
                style={{ transitionDelay: `${index * 150}ms` }}
                data-animate-on-scroll
                data-testid={`feature-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 feature-icon-wrap">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="scroll-anim from-left" data-animate-on-scroll>
              <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">OUR PROMISE</div>
              <h2 className="text-3xl font-bold text-foreground mb-4" style={{ fontFamily: "Poppins, sans-serif" }}>
                Freshly Cooked,<br />Every Single Day
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We prepare every item fresh daily — no pre-cooking, no reheating. Just wholesome Jain food delivered hot to your doorstep.
              </p>
              {[
                { icon: ShieldCheck, text: "Strictly no onion, garlic, or root vegetables" },
                { icon: Clock, text: "Fresh preparation starts at 7 AM every day" },
                { icon: Star, text: "Trusted by 500+ families across Navi Mumbai" },
              ].map((item, index) => (
                <div
                  key={item.text}
                  className="flex items-start gap-3 mb-3 scroll-anim from-left"
                  style={{ transitionDelay: `${index * 200}ms` }}
                  data-animate-on-scroll
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{item.text}</p>
                </div>
              ))}
              <div className="mt-8">
                <Link to="/menu">
                  <Button className="bg-primary hover:bg-primary/90 text-white" data-testid="btn-explore-menu">
                    Explore Our Menu <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden scroll-anim from-right" style={{ transitionDelay: "100ms" }} data-animate-on-scroll>
              <img
                src="https://in.pinterest.com/pin/593560425928692518/"
                alt="Jain thali"
                className="w-full h-80 object-cover"
                data-testid="img-thali"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-12 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              to="/contact"
              className="rounded-2xl border-2 border-blue-200 bg-blue-50/80 p-6 text-left block home-service-card scroll-anim from-bottom"
              style={{ transitionDelay: "0ms" }}
              data-animate-on-scroll
            >
              <UtensilsCrossed className="w-8 h-8 text-blue-600 mb-3 service-card-icon" />
              <h3 className="font-semibold text-foreground mb-1">Bulk orders &amp; catering</h3>
              <p className="text-sm text-muted-foreground">Events, weddings, corporate.</p>
            </Link>
            <Link
              to="/snacks"
              className="rounded-2xl border-2 border-orange-200 bg-orange-50/80 p-6 text-left block home-service-card scroll-anim from-bottom"
              style={{ transitionDelay: "150ms" }}
              data-animate-on-scroll
            >
              <Cookie className="w-8 h-8 text-orange-600 mb-3 service-card-icon" />
              <h3 className="font-semibold text-foreground mb-1">Snacks store</h3>
              <p className="text-sm text-muted-foreground">Khakhra, Namkeen &amp; more.</p>
            </Link>
            <Link
              to="/gallery"
              className="rounded-2xl border-2 border-green-200 bg-green-50/80 p-6 text-left block home-service-card scroll-anim from-bottom"
              style={{ transitionDelay: "300ms" }}
              data-animate-on-scroll
            >
              <Images className="w-8 h-8 text-green-600 mb-3 service-card-icon" />
              <h3 className="font-semibold text-foreground mb-1">Gallery</h3>
              <p className="text-sm text-muted-foreground">Kitchen &amp; food photos.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 scroll-anim from-bottom" data-animate-on-scroll>
            <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">CUSTOMER REVIEWS</div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground" style={{ fontFamily: "Poppins, sans-serif" }}>
              Trusted by Jain Families Across Mumbai
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Real feedback from customers who rely on our fresh, pure Jain meals every day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Priyanka Shah",
                area: "Vastrapur",
                review:
                  "Food quality is consistently excellent. Taste feels like home, and I never worry about Jain restrictions.",
              },
              {
                name: "Nirav Mehta",
                area: "Bodakdev",
                review:
                  "Very punctual delivery and perfectly packed meals. Their weekly menu variety is great for office lunch.",
              },
              {
                name: "Riddhi Jain",
                area: "Satellite",
                review:
                  "Best option for pure Jain food in our area. Fresh, light, and hygienic — our family trusts them fully.",
              },
            ].map((item, index) => (
              <article
                key={item.name}
                className="bg-card border border-card-border rounded-2xl p-6 home-feature-card scroll-anim from-bottom"
                style={{ transitionDelay: `${index * 150}ms` }}
                data-animate-on-scroll
              >
                <div className="flex items-center gap-1.5 mb-3 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">"{item.review}"</p>
                <div className="pt-3 border-t border-border">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.area}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-1 text-xs font-semibold tracking-wide mb-4 scroll-anim from-top" data-animate-on-scroll>
            DAILY FRESH JAIN TIFFIN
          </div>
          <h2 className="text-3xl font-bold mb-4 scroll-anim from-bottom" style={{ fontFamily: "Poppins, sans-serif", transitionDelay: "120ms" }} data-animate-on-scroll>
            Ready for a wholesome Jain meal?
          </h2>
          <p className="text-white/80 mb-8 scroll-anim from-bottom" style={{ transitionDelay: "240ms" }} data-animate-on-scroll>
            Order now and get fresh Jain food delivered to your home today.
          </p>
          <Link to="/menu">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 font-semibold pulse-cta scroll-anim from-bottom"
              style={{ transitionDelay: "360ms" }}
              data-animate-on-scroll
              data-testid="btn-cta-order"
            >
              Order Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
