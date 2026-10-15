"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  delayMs?: number;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
}

interface Coords {
  top: number;
  left: number;
  actualSide: TooltipSide;
}

export function Tooltip({
  content,
  children,
  side = "top",
  delayMs = 80,
  className = "",
  wrapperClassName = "",
  disabled = false,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0, actualSide: side });
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPointerDownRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const calculatePosition = useCallback((): Coords | null => {
    if (!triggerRef.current) return null;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    const padding = 10;

    let targetSide = side;

    // Viewport boundary checks for smart flipping
    if (side === "top" && triggerRect.top < 38) {
      targetSide = "bottom";
    } else if (side === "bottom" && window.innerHeight - triggerRect.bottom < 38) {
      targetSide = "top";
    } else if (side === "left" && triggerRect.left < 80) {
      targetSide = "right";
    } else if (side === "right" && window.innerWidth - triggerRect.right < 80) {
      targetSide = "left";
    }

    let top = 0;
    let left = 0;

    switch (targetSide) {
      case "top":
        top = triggerRect.top - gap;
        left = triggerRect.left + triggerRect.width / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + triggerRect.width / 2;
        break;
      case "left":
        top = triggerRect.top + triggerRect.height / 2;
        left = triggerRect.left - gap;
        break;
      case "right":
        top = triggerRect.top + triggerRect.height / 2;
        left = triggerRect.right + gap;
        break;
    }

    // Keep horizontal alignment within screen bounds (prevent edge overflow)
    const measuredHalfWidth = tooltipRef.current
      ? tooltipRef.current.offsetWidth / 2
      : 60;

    if (targetSide === "top" || targetSide === "bottom") {
      const minLeft = padding + measuredHalfWidth;
      const maxLeft = window.innerWidth - padding - measuredHalfWidth;
      left = Math.max(minLeft, Math.min(maxLeft, left));
    } else {
      left = Math.max(padding, Math.min(window.innerWidth - padding, left));
    }

    return { top, left, actualSide: targetSide };
  }, [side]);

  const updatePosition = useCallback(() => {
    const pos = calculatePosition();
    if (pos) {
      setCoords(pos);
    }
  }, [calculatePosition]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const show = useCallback(() => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delayMs);
  }, [disabled, content, delayMs, updatePosition]);

  // Hide when disabled state becomes true
  useEffect(() => {
    if (disabled && isOpen) {
      hide();
    }
  }, [disabled, isOpen, hide]);

  // Global dismissal handlers when open:
  // Immediately hides on scroll, Escape key, tab switch / window blur, mouse leaving window, or outside pointer press.
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      hide();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
      }
    };

    const handleWindowBlur = () => {
      hide();
    };

    const handleDocMouseLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        hide();
      }
    };

    const handleOutsidePointer = (e: PointerEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        hide();
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("mouseleave", handleDocMouseLeave);
    window.addEventListener("pointerdown", handleOutsidePointer, true);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("mouseleave", handleDocMouseLeave);
      window.removeEventListener("pointerdown", handleOutsidePointer, true);
    };
  }, [isOpen, hide]);

  // Trigger event handlers
  const handlePointerEnter = useCallback(() => {
    show();
  }, [show]);

  const handlePointerLeave = useCallback(() => {
    hide();
  }, [hide]);

  const handlePointerDown = useCallback(() => {
    isPointerDownRef.current = true;
    hide();
  }, [hide]);

  const handlePointerUp = useCallback(() => {
    setTimeout(() => {
      isPointerDownRef.current = false;
    }, 150);
  }, []);

  const handleClick = useCallback(() => {
    hide();
  }, [hide]);

  const handleFocus = useCallback(
    (e: React.FocusEvent) => {
      // Don't show if focus was caused by a mouse click/tap
      if (isPointerDownRef.current) return;
      try {
        if ((e.target as HTMLElement)?.matches?.(":focus-visible")) {
          show();
          return;
        }
      } catch {
        // fallback
      }
      if (!isPointerDownRef.current) {
        show();
      }
    },
    [show]
  );

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  // Transform offset based on side
  let transform = "translate(-50%, -100%)";
  if (coords.actualSide === "bottom") {
    transform = "translate(-50%, 0)";
  } else if (coords.actualSide === "left") {
    transform = "translate(-100%, -50%)";
  } else if (coords.actualSide === "right") {
    transform = "translate(0, -50%)";
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center justify-center ${wrapperClassName}`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {children}
      </span>

      {mounted &&
        isOpen &&
        content &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            aria-hidden={!isOpen}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform,
              zIndex: 99999,
              pointerEvents: "none",
              userSelect: "none",
            }}
            className={`pointer-events-none select-none whitespace-nowrap rounded-lg border border-neutral-700/80 bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium tracking-normal text-white shadow-xl backdrop-blur-xs transition-opacity duration-100 ${className}`}
          >
            {content}

            {/* Directional arrow caret */}
            {coords.actualSide === "top" && (
              <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 border-x-4 border-t-4 border-b-0 border-x-transparent border-t-neutral-900" />
            )}
            {coords.actualSide === "bottom" && (
              <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 border-x-4 border-b-4 border-t-0 border-x-transparent border-b-neutral-900" />
            )}
            {coords.actualSide === "left" && (
              <span className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 border-y-4 border-l-4 border-r-0 border-y-transparent border-l-neutral-900" />
            )}
            {coords.actualSide === "right" && (
              <span className="pointer-events-none absolute -left-1 top-1/2 -translate-y-1/2 border-y-4 border-r-4 border-l-0 border-y-transparent border-r-neutral-900" />
            )}
          </div>,
          document.body
        )}
    </>
  );
}
