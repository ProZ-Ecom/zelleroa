import React from "react";

/** Clothing rack illustration drawn in the theme's primary/secondary colors. */
export function AboutFashionIllustration({ className }: { className?: string }) {
  const hangerXs = [120, 200, 280];

  return (
    <svg
      viewBox="0 0 400 300"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Clothing rack with a dress, a shirt, a kurta and a shopping bag"
      className={className}
    >
      {/* Floor */}
      <ellipse cx="200" cy="284" rx="170" ry="8" fill="white" opacity="0.08" />

      {/* Rack */}
      <g stroke="var(--primary-100)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9">
        <line x1="62" y1="60" x2="338" y2="60" />
        <line x1="80" y1="60" x2="62" y2="280" />
        <line x1="320" y1="60" x2="338" y2="280" />
        <line x1="40" y1="280" x2="84" y2="280" />
        <line x1="316" y1="280" x2="360" y2="280" />
      </g>

      {/* Hangers */}
      <g stroke="var(--primary-100)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {hangerXs.map((x) => (
          <g key={x}>
            <path d={`M ${x} 76 v -6 a 7 7 0 1 1 7 -7`} />
            <path d={`M ${x - 28} 92 L ${x} 76 L ${x + 28} 92`} />
          </g>
        ))}
      </g>

      {/* Dress */}
      <path
        d="M 96 91 L 144 91 L 139 122 L 168 228 Q 120 238 72 228 L 101 122 Z"
        fill="var(--tertiary-300)"
      />
      <path d="M 101 122 L 139 122" stroke="var(--tertiary-400)" strokeWidth="6" />
      <path d="M 110 91 Q 120 104 130 91" fill="var(--tertiary-400)" />

      {/* Shirt */}
      <path d="M 177 92 L 158 142 L 170 147 L 179 116 Z" fill="white" />
      <path d="M 223 92 L 242 142 L 230 147 L 221 116 Z" fill="white" />
      <rect x="176" y="90" width="48" height="112" rx="4" fill="white" />
      <path d="M 188 90 L 200 104 L 212 90" fill="var(--primary-200)" />
      <line x1="200" y1="104" x2="200" y2="202" stroke="var(--primary-200)" strokeWidth="2" />
      {[118, 138, 158, 178].map((y) => (
        <circle key={y} cx="200" cy={y} r="2.5" fill="var(--theme-primary)" />
      ))}

      {/* Kurta */}
      <path d="M 257 92 L 240 152 L 251 156 L 260 114 Z" fill="var(--primary-300)" />
      <path d="M 303 92 L 320 152 L 309 156 L 300 114 Z" fill="var(--primary-300)" />
      <path d="M 256 90 L 304 90 L 313 244 L 247 244 Z" fill="var(--primary-300)" />
      <path d="M 272 90 Q 280 100 288 90" fill="var(--primary-200)" />
      <line x1="280" y1="96" x2="280" y2="124" stroke="var(--tertiary-300)" strokeWidth="2.5" />
      <path d="M 248 232 L 312 232" stroke="var(--tertiary-300)" strokeWidth="4" />
      {[
        [264, 150], [296, 150], [280, 172], [264, 194], [296, 194], [280, 216],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="var(--tertiary-300)" />
      ))}

      {/* Shopping bag */}
      <path
        d="M 334 222 v -10 a 14 14 0 0 1 28 0 v 10"
        stroke="var(--tertiary-300)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="322" y="218" width="52" height="62" rx="6" fill="var(--tertiary-300)" />
      <text
        x="348"
        y="259"
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fontFamily="Georgia, serif"
        fill="var(--tertiary-900)"
      >
        Z
      </text>

      {/* Sparkles */}
      <g fill="var(--tertiary-200)">
        <path d="M 52 30 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 Z" />
        <path d="M 360 120 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" opacity="0.8" />
      </g>
    </svg>
  );
}

export default AboutFashionIllustration;
