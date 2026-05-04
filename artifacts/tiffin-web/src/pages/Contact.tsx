import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, MessageSquare, MapPin, Clock, Instagram, Facebook, Twitter, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Navbar } from "@/components/Navbar";
import { useSubmitContact, useListDeliveryAreas, useGetSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(10, "Valid phone required"),
  email: z.string().email("Valid email").optional().or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters"),
});
type ContactFormData = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const { data: areas } = useListDeliveryAreas();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", message: "" },
  });

  const submitContact = useSubmitContact({
    mutation: {
      onSuccess: () => {
        toast({ title: "Message sent!", description: "We will get back to you shortly on WhatsApp." });
        form.reset();
      },
      onError: () => toast({ title: "Error", description: "Failed to send message.", variant: "destructive" }),
    }
  });

  const contactInfo = [
    {
      icon: Phone,
      title: "Call Us",
      content: settings?.contact_number || "+91 86908 57887",
      sub: "Mon - Sun, 9 AM - 6:30 PM",
      link: `tel:${settings?.contact_number || "+918690857887"}`,
      linkLabel: "Call Now",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp",
      content: settings?.contact_number || "+91 8690857887",
      sub: "Quick replies on WhatsApp",
      link: `https://wa.me/918690857887`,
      linkLabel: "Chat Now",
    },
    {
      icon: MapPin,
      title: "Our Kitchen",
      content: "Jain Bhavan, Sector-12",
      sub: "Kharghar, Navi Mumbai - 410 210",
      link: "https://share.google/oKG8qaFDgW75D9YXt",
      linkLabel: "Get Directions",
    },
    {
      icon: Clock,
      title: "Delivery Hours",
      content: "Lunch: 11 AM - 2 PM",
      sub: "Dinner: 4 PM - 6:30 PM",
      link: null,
      linkLabel: null,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-2" style={{ fontFamily: "Poppins, sans-serif" }}>Contact Us</h1>
          <p className="text-muted-foreground">Have a question, want a monthly subscription, or just want to say hello? Reach out — we reply within a few hours on WhatsApp.</p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {contactInfo.map(info => (
            <div key={info.title} className="bg-card border border-card-border rounded-2xl p-5" data-testid={`contact-card-${info.title.toLowerCase().replace(" ", "-")}`}>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                <info.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">{info.title}</h3>
              <p className="text-sm text-foreground">{info.content}</p>
              <p className="text-xs text-muted-foreground">{info.sub}</p>
              {info.link && (
                <a href={info.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium mt-2 block hover:underline" data-testid={`link-${info.title.toLowerCase().replace(" ", "-")}`}>
                  {info.linkLabel} →
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 mt-16">
          {/* Left: Map & Delivery Areas (3 columns width) */}
          <div className="lg:col-span-3 space-y-6 flex flex-col">
            <div className="bg-card border border-card-border rounded-3xl overflow-hidden shadow-sm flex-1 min-h-[400px]">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.461781172211!2d73.0629020756822!3d19.043424052993398!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c3006ee5fcd1%3A0x1eacfd7a2cedaa6!2sJain%20Bhavan%20Satvik%20Aahar%20aium%20Niwas%20Gruh!5e0!3m2!1sen!2sin!4v1777476614565!5m2!1sen!2sin%22%20width=%22600%22%20height=%22450%22%20style=%22border:0;%22%20allowfullscreen=%22%22%20loading=%22lazy%22%20referrerpolicy=%22no-referrer-when-downgrade"
                className="w-full h-full min-h-[400px]"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Kitchen Location"
                data-testid="map-kitchen"
              />
            </div>
            
            <div className="bg-card/50 border border-card-border rounded-3xl p-6 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                 <MapPin className="w-5 h-5 text-primary" /> Delivery Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {areas?.map(area => (
                  <span key={area.id} className="bg-white text-foreground text-xs px-4 py-2 rounded-full border border-border shadow-sm font-medium" data-testid={`delivery-area-${area.id}`}>
                    {area.name} <span className="text-primary font-semibold ml-1">&#x20B9;{area.delivery_charge}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Contact Details and Form (2 columns width) */}
          <div className="lg:col-span-2 space-y-8">
             <div className="bg-card border border-card-border rounded-3xl p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-foreground mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>Get in Touch</h2>
                
                <div className="space-y-6 mb-8">
                   <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                         <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                         <p className="font-medium text-foreground">Jain Bhavan, Sector -12</p>
                         <p className="text-sm text-muted-foreground">Kharghar, Navi Mumbai - 410 210</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                         <Phone className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                         <p className="font-medium text-foreground">{settings?.contact_number || "+91 98765 43210"}</p>
                         <p className="text-sm text-muted-foreground">Mon - Sun, 9 AM - 6:30 PM</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                         <Mail className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                         <p className="font-medium text-foreground">satvikahargrah12@gmail.com</p>
                         <p className="text-sm text-muted-foreground">We reply within 24 hours</p>
                      </div>
                   </div>
                </div>

                <div className="pt-6 border-t border-border">
                   <h3 className="font-medium text-foreground mb-4">Follow Us</h3>
                   <div className="flex gap-3">
                      {/* <a href="#" className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors duration-300">
                         <Facebook className="w-5 h-5" />
                      </a> */}
                      <a href="https://www.instagram.com/satvikahargruh/" className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center hover:bg-pink-600 hover:text-white transition-colors duration-300">
                         <Instagram className="w-5 h-5" />
                      </a>
                      {/* <a href="#" className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-500 hover:text-white transition-colors duration-300">
                         <Twitter className="w-5 h-5" />
                      </a> */}
                      {/* <a href="#" className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-colors duration-300">
                         <MessageSquare className="w-5 h-5" />
                      </a> */}
                   </div>
                </div>
             </div>

            {/* Contact Form */}
            <div className="bg-card border border-card-border rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground mb-1">Send a Message</h3>
              <p className="text-sm text-muted-foreground mb-6">Bulk orders, queries, or subscriptions.</p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(data => submitContact.mutate({ data: { ...data, email: data.email || undefined } }))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input className="bg-white border-card-border" placeholder="Full Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input className="bg-white border-card-border" placeholder="Mobile Number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="How can we help you?"
                            className="h-28 resize-none bg-white border-card-border"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6"
                    disabled={submitContact.isPending}
                  >
                    {submitContact.isPending ? "Sending..." : "Send Message"} <Send className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
