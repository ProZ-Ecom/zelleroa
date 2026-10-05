import type { ReactNode } from "react";

interface ProfileAvatarRingProps {
  /** 0–100 completed share. */
  percent: number;
  /** Outer diameter in px (avatar sits inside the ring). */
  size: number;
  children: ReactNode;
  /** Hide the numeric pill, e.g. when the avatar is very small and a title is enough. */
  hideBadge?: boolean;
}

/** Wraps an avatar in a completion ring and pins the percentage to its corner. */
export function ProfileAvatarRing({ percent, size, children, hideBadge = false }: ProfileAvatarRingProps) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  const stroke = Math.max(2, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = value === 100;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={`Profile ${value}% complete`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-neutral-300/70" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className={`${done ? "stroke-emerald-500" : "stroke-amber-500"} transition-all duration-500`}
        />
      </svg>
      <span className="flex items-center justify-center overflow-hidden rounded-full" style={{ width: size - stroke * 2 - 2, height: size - stroke * 2 - 2 }}>
        {children}
      </span>
      {!hideBadge && (
        <span
          className={`absolute -bottom-1 -right-2 rounded-full px-1 text-[9px] font-bold leading-4 text-white shadow-xs ${
            done ? "bg-emerald-600" : "bg-amber-600"
          }`}
        >
          {value}%
        </span>
      )}
    </span>
  );
}
