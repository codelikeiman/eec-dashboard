import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fraunces, manrope } from "@/lib/fonts";
import { getSiteUrl, SHARE_DESCRIPTION, SHARE_TITLE, SITE_NAME } from "@/lib/site";
import "./globals.css";

/**
 * Root layout: Indonesian only, the same fonts and colours as the website,
 * and never indexed by search engines.
 */
export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: "Dashboard", template: "%s — Dashboard EEC" },
  description: SHARE_DESCRIPTION,
  // Link previews (WhatsApp, Telegram, LinkedIn, X). The image comes from
  // app/opengraph-image.tsx and app/twitter-image.tsx. No og:url on purpose:
  // shared links redirect to /login, and a fixed og:url would loop crawlers.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "id_ID",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }] },
};

export const viewport: Viewport = { themeColor: "#f6f1e7" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${fraunces.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
