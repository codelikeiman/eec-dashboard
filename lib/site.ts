/** Text used in <title>, Open Graph and X (Twitter) cards. */
export const SITE_NAME = "Essential English Course";
export const SHARE_TITLE = "Dashboard Uang Les — Essential English Course";
export const SHARE_DESCRIPTION =
  "Catat uang les, pantau siapa yang sudah dan belum bayar, rekap per bulan, target, dan data murid. Khusus admin dan guru Essential English Course.";

/**
 * Absolute URL of this dashboard, needed so link previews get a full image URL.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://dashboard.your-domain.id).
 */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3001");
}
