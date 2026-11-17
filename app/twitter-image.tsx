import { renderShareCard, shareCardAlt, shareCardSize } from "@/lib/share-card";

// Read by X (twitter:image). Same card as Open Graph.
export const size = shareCardSize;
export const contentType = "image/png";
export const alt = shareCardAlt;

export default function TwitterImage() {
  return renderShareCard();
}
