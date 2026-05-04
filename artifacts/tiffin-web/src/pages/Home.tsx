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
                src="data:image/jpeg;base64,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"
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
