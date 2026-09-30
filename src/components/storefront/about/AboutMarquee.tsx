import React from "react";
import { Sparkle } from "lucide-react";

const items = [
  "Convenient online shopping",
  "Fashion for our customers",
  "Customer care 10 AM – 6 PM, all days",
  "Simple ordering",
  "Sales Partner network",
  "Accessible to everyone",
];

/** Tilted, endlessly scrolling ribbon of brand highlights. */
export function AboutMarquee() {
  // Rendered twice so the -50% translate loops seamlessly.
  const loop = [...items, ...items];

  return (
    <div className="relative bg-about-story-bg py-8 sm:py-10 overflow-hidden" aria-label="Highlights">
      <div className="-rotate-2 -mx-4 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 py-4 shadow-xl">
        <div className="about-marquee flex w-max items-center gap-8 pr-8">
          {loop.map((item, index) => (
            <span
              key={`${item}-${index}`}
              aria-hidden={index >= items.length}
              className="flex items-center gap-8 text-sm sm:text-base font-semibold tracking-wide text-white whitespace-nowrap"
            >
              {item}
              <Sparkle className="w-4 h-4 text-tertiary-200 fill-tertiary-200" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AboutMarquee;
