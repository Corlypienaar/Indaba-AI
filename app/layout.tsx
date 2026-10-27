import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE = "https://indaba-ai.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "IndabaAI", template: "%s | IndabaAI" },
  description:
    "Practical AI help for South African small businesses. Answer a few simple questions and get your ads written, your pricing checked or your business idea tested. Free, no sign-up.",
  openGraph: {
    title: "IndabaAI",
    description:
      "Practical AI help for South African small businesses. Ads, pricing, WhatsApp, business ideas and more, one step at a time.",
    url: SITE,
    siteName: "IndabaAI",
    images: [{ url: "/preview.png", width: 1200, height: 630, alt: "IndabaAI" }],
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "IndabaAI", images: ["/preview.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
