"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

interface SalesChartProps {
  data: { label: string; value: number; orders?: number }[];
  rangeLabel?: string;
}

const W = 720;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 30, left: 52 };

function compact(v: number) {
  if (v >= 10_000_000) return `₹${+(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000) return `₹${+(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${+(v / 1_000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function SalesChart({ data, rangeLabel = "Last 7 days" }: SalesChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const total = data.reduce((s, d) => s + d.value, 0);
  const orders = data.reduce((s, d) => s + (d.orders ?? 0), 0);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: PAD.top + innerH - (d.value / max) * innerH,
    ...d,
  }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = points.length
    ? `${line} L${points[points.length - 1].x},${PAD.top + innerH} L${points[0].x},${PAD.top + innerH} Z`
    : "";
  const labelEvery = Math.ceil(data.length / 8);
  const active = hover !== null ? points[hover] : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--color-neutral-200)]/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-neutral-900)]">
            Sales Overview
          </h3>
          <p className="text-sm text-[var(--color-neutral-500)]">{rangeLabel} revenue</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-[var(--color-neutral-500)] uppercase">
              Orders
            </p>
            <p className="text-lg font-bold text-[var(--color-neutral-900)] tabular-nums">{orders}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-[var(--color-neutral-500)] uppercase">
              Total
            </p>
            <p className="text-lg font-bold text-[var(--color-neutral-900)] tabular-nums">
              {formatPrice(total)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full min-h-64 w-full"
          role="img"
          aria-label="Revenue trend"
        >
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-500)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary-500)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticks.map((t) => {
            const y = PAD.top + innerH - innerH * t;
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--neutral-200)"
                  strokeDasharray={t === 0 ? undefined : "3 5"}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--neutral-500)"
                >
                  {compact(max * t)}
                </text>
              </g>
            );
          })}

          <path d={area} fill="url(#sales-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--primary-600)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {active && (
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--primary-300)"
              strokeDasharray="4 4"
            />
          )}
          {points.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - innerW / data.length / 2}
                y={PAD.top}
                width={innerW / data.length}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {(hover === i || (data.length <= 14 && p.value > 0)) && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hover === i ? 5.5 : 3.5}
                  fill="white"
                  stroke="var(--primary-600)"
                  strokeWidth={2}
                />
              )}
              {i % labelEvery === 0 && (
                <text
                  x={p.x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--neutral-500)"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-[var(--neutral-900)] px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: `${(active.x / W) * 100}%`,
              top: `${Math.max((active.y / H) * 100 - 22, 0)}%`,
            }}
          >
            <p className="font-medium text-white/70">{active.label}</p>
            <p className="text-sm font-bold">{formatPrice(active.value)}</p>
            <p className="text-white/70">{active.orders ?? 0} orders</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { SalesChart };
