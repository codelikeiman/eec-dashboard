import { Manrope } from "next/font/google";
import localFont from "next/font/local";

/** Display serif: Fraunces, self-hosted (see assets/fonts/NOTICE.md). Same as the website. */
export const fraunces = localFont({
  src: [
    { path: "../assets/fonts/Fraunces-Roman-opsz.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/Fraunces-Italic-opsz.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/** Body & UI grotesk. */
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
