import { renderShareCard, shareCardAlt, shareCardSize } from "@/lib/share-card";

// Read by WhatsApp, Telegram, LinkedIn (og:image) — generated once at build time.
export const size = shareCardSize;
export const contentType = "image/png";
export const alt = shareCardAlt;

export default function OpengraphImage() {
  return renderShareCard();
}
