import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "./site";

/** 1200×630: the size WhatsApp, Telegram, LinkedIn and X all crop well. */
export const shareCardSize = { width: 1200, height: 630 };
export const shareCardAlt = "Dashboard uang les & data murid — Essential English Course";

const font = (file: string) => readFile(join(process.cwd(), "assets/og-fonts", file));

// Decorative columns only (no real numbers): billed (paper) behind collected (tomato).
const bars = [
  [0.62, 0.48],
  [0.7, 0.6],
  [0.74, 0.66],
  [0.8, 0.77],
  [0.84, 0.8],
  [0.9, 0.9],
];

/** Social share card in the dashboard's own type and colours (same as the website). */
export async function renderShareCard() {
  const [regular, italic, sans] = await Promise.all([
    font("Fraunces-144-Regular.woff"),
    font("Fraunces-144-Italic.woff"),
    font("Manrope-SemiBold.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f1e7",
          color: "#1a1a1a",
          padding: "56px 72px 52px",
          fontFamily: "Manrope",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "3px solid #1a1a1a",
            paddingBottom: 14,
            fontSize: 20,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <span>{SITE_NAME}</span>
          <span style={{ color: "#5c564d" }}>Dashboard internal</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Fraunces",
              fontSize: 96,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            <span>Uang les &amp;</span>
            <span style={{ display: "flex" }}>
              <span style={{ marginRight: 24 }}>data</span>
              <span style={{ display: "flex", flexDirection: "column", fontStyle: "italic" }}>
                <span>murid</span>
                <svg width="100%" height="22" viewBox="0 0 320 30" style={{ marginTop: -14 }}>
                  <path
                    d="M6 19C58 12 120 9.5 178 11c48 1.3 92 4.5 136-2"
                    stroke="#e4572e"
                    strokeWidth="9"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </span>
            <span style={{ fontFamily: "Manrope", fontSize: 28, letterSpacing: 0, color: "#5c564d", marginTop: 26 }}>
              {"Siapa sudah bayar, siapa belum, rekap tiap bulan.".replaceAll(", ", ",\u00a0")}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              height: 250,
              paddingBottom: 6,
              borderBottom: "2px solid #1a1a1a",
            }}
          >
            {bars.map(([billed, collected], i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-end", marginLeft: i ? 18 : 0 }}>
                <div style={{ width: 22, height: billed * 236, background: "#e6dccb", borderRadius: "4px 4px 0 0" }} />
                <div
                  style={{
                    width: 22,
                    height: collected * 236,
                    background: "#e4572e",
                    borderRadius: "4px 4px 0 0",
                    marginLeft: 3,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22 }}>
          <span style={{ display: "flex" }}>
            {["Pembayaran", "Rekap & target", "Murid", "Guru"].map((label) => (
              <span
                key={label}
                style={{
                  display: "flex",
                  border: "2px solid #1a1a1a",
                  borderRadius: 999,
                  padding: "8px 20px",
                  marginRight: 12,
                }}
              >
                {label}
              </span>
            ))}
          </span>
          <span
            style={{
              display: "flex",
              background: "#1f4d3a",
              color: "#f6f1e7",
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 18,
              letterSpacing: 2.5,
              textTransform: "uppercase",
            }}
          >
            Admin &amp; guru
          </span>
        </div>
      </div>
    ),
    {
      ...shareCardSize,
      fonts: [
        { name: "Fraunces", data: regular, style: "normal", weight: 400 },
        { name: "Fraunces", data: italic, style: "italic", weight: 400 },
        { name: "Manrope", data: sans, style: "normal", weight: 600 },
      ],
    },
  );
}
