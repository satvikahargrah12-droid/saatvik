/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_SERVER_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  /** Public storefront origin for links in WhatsApp menu shares (e.g. https://orders.example.com). Defaults to current origin. */
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
