"use client";

import { useState } from "react";
import { periodLabel, rupiah, rupiahShort } from "@/lib/dashboard/format";

type Point = { period: string; expected: number; collected: number; target: number | null };

const H = 220; // plot height
const PAD_TOP = 18;
const PAD_BOTTOM = 26;
const AXIS_W = 58;

function niceMax(value: number) {
  if (value <= 0) return 1_000_000;
  const exp = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * exp >= value / 4) ?? 10;
  return Math.ceil(value / (step * exp)) * step * exp;
}

/**
 * Collected (tomato column) against billed (neutral column behind it) and the
 * month's target (ink tick). One y-axis, hairline grid, hover tooltip, and a
 * table for screen readers.
 */
export function TrendChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.flatMap((d) => [d.expected, d.collected, d.target ?? 0])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v: number) => PAD_TOP + H - (v / max) * H;
  const slot = 100 / data.length;

  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-muted" aria-hidden="true">
        <li className="flex items-center gap-2"><span className="size-3 rounded-[2px] bg-tomato" />Terkumpul</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-[2px] bg-paper-3 ring-1 ring-ink/15" />Tagihan</li>
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 bg-ink" />Target</li>
      </ul>

      <div className="relative" style={{ height: PAD_TOP + H + PAD_BOTTOM }}>
        {/* y-axis + hairline grid */}
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={AXIS_W} x2="100%" y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" />
              <text x={AXIS_W - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-muted text-[11px] tabular">
                {t === 0 ? "0" : rupiahShort(t).replace("Rp ", "")}
              </text>
            </g>
          ))}
        </svg>

        {/* columns, laid out in HTML so they stay crisp at any width */}
        <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS_W }}>
          {data.map((d, i) => {
            const barH = (v: number) => Math.max((v / max) * H, v > 0 ? 2 : 0);
            return (
              <div
                key={d.period}
                className="relative h-full"
                style={{ width: `${slot}%` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${periodLabel(d.period)}: terkumpul ${rupiah(d.collected)} dari tagihan ${rupiah(d.expected)}${d.target ? `, target ${rupiah(d.target)}` : ""}`}
              >
                {hover === i ? <div className="absolute inset-x-1 bg-ink/[0.04]" style={{ top: PAD_TOP, height: H }} /> : null}
                <div className="absolute flex items-end justify-center gap-[2px]" style={{ left: 0, right: 0, top: PAD_TOP, height: H }}>
                  <div className="w-[min(40%,24px)] rounded-t-[4px] bg-paper-3 ring-1 ring-ink/10" style={{ height: barH(d.expected) }} />
                  <div className="w-[min(40%,24px)] rounded-t-[4px] bg-tomato" style={{ height: barH(d.collected) }} />
                </div>
                {d.target ? (
                  <div className="absolute left-[18%] right-[18%] h-0.5 bg-ink" style={{ top: y(d.target) - 1 }} />
                ) : null}
                <p className="absolute inset-x-0 bottom-0 text-center text-[11px] text-ink-muted">
                  {periodLabel(d.period, true)}
                </p>
                {hover === i ? (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-md border border-ink/20 bg-paper px-3 py-2 text-[0.8125rem] shadow-float"
                    style={{ left: "50%", top: Math.max(y(Math.max(d.expected, d.collected, d.target ?? 0)) - 86, 0) }}
                  >
                    <p className="font-semibold">{periodLabel(d.period)}</p>
                    <p className="tabular">Terkumpul {rupiah(d.collected)}</p>
                    <p className="tabular text-ink-muted">Tagihan {rupiah(d.expected)}</p>
                    {d.target ? <p className="tabular text-ink-muted">Target {rupiah(d.target)}</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <table className="sr-only">
        <caption>Uang les per bulan</caption>
        <thead>
          <tr><th>Bulan</th><th>Terkumpul</th><th>Tagihan</th><th>Target</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.period}>
              <td>{periodLabel(d.period)}</td>
              <td>{rupiah(d.collected)}</td>
              <td>{rupiah(d.expected)}</td>
              <td>{d.target ? rupiah(d.target) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
