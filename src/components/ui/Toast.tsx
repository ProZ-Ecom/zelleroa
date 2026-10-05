"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return context;
}

const APP_TOAST_EVENT = "app-toast-event";
const recentToasts = new Map<string, number>();
const DEDUPE_TIME_MS = 2500;

type ToastInput =
  | Omit<Toast, "id">
  | {
      title: string;
      description?: string;
      variant?: ToastVariant | "default" | "destructive";
      duration?: number;
    };

let successToastAttempts = 0;

/** Number of success toasts requested so far (including ones deduped away). */
export function getSuccessToastAttempts() {
  return successToastAttempts;
}

function showToast(toastData: ToastInput) {
  if (typeof window === "undefined") return;

  const variant: ToastVariant =
    toastData.variant === "destructive"
      ? "error"
      : toastData.variant === "default" || !toastData.variant
      ? "success"
      : toastData.variant;

  if (variant === "success") successToastAttempts++;

  // Deduplicate based on message content to prevent dual toasts from MutationCache & components
  const content = (toastData.description || toastData.title || "").trim().toLowerCase();
  const dedupeKey = `${variant}:${content}`;
  const now = Date.now();
  const lastShown = recentToasts.get(dedupeKey);

  if (lastShown && now - lastShown < DEDUPE_TIME_MS) {
    return; // Skip duplicate toast within dedupe window
  }

  recentToasts.set(dedupeKey, now);
  setTimeout(() => {
    recentToasts.delete(dedupeKey);
  }, DEDUPE_TIME_MS);

  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: {
        title: toastData.title,
        description: toastData.description,
        variant,
        duration: toastData.duration,
      },
    })
  );
}

export const toast = Object.assign(showToast, {
  show: showToast,
  success: (title: string, description?: string, duration?: number) => {
    showToast({ variant: "success", title, description, duration });
  },
  error: (title: string, description?: string, duration?: number) => {
    showToast({ variant: "error", title, description, duration });
  },
  warning: (title: string, description?: string, duration?: number) => {
    showToast({ variant: "warning", title, description, duration });
  },
  info: (title: string, description?: string, duration?: number) => {
    showToast({ variant: "info", title, description, duration });
  },
});

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((newToast: Omit<Toast, "id">) => {
    const newContent = (newToast.description || newToast.title || "").trim().toLowerCase();

    setToasts((prev) => {
      const alreadyActive = prev.some((t) => {
        const existingContent = (t.description || t.title || "").trim().toLowerCase();
        return t.variant === newToast.variant && existingContent === newContent;
      });
      if (alreadyActive) {
        return prev;
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, newToast.duration ?? 5000);

      return [...prev, { ...newToast, id }];
    });
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<Omit<Toast, "id">>;
      if (customEvent.detail) {
        addToast(customEvent.detail);
      }
    };

    window.addEventListener(APP_TOAST_EVENT, handleCustomToast);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handleCustomToast);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

const toastVariantStyles: Record<
  ToastVariant,
  { progressTrack: string; progressBar: string }
> = {
  success: {
    progressTrack: "bg-success-100",
    progressBar: "bg-success-600",
  },
  error: {
    progressTrack: "bg-error-100",
    progressBar: "bg-error-600",
  },
  warning: {
    progressTrack: "bg-amber-100",
    progressBar: "bg-amber-700",
  },
  info: {
    progressTrack: "bg-secondary-100",
    progressBar: "bg-secondary-600",
  },
};

const toastIcons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
      <Check className="h-3 w-3 stroke-[3]" />
    </div>
  ),
  error: (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error-600 text-white">
      <span className="text-[11px] font-black leading-none select-none">!</span>
    </div>
  ),
  warning: (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center text-amber-700">
      <AlertTriangle className="h-5 w-5 fill-amber-700 text-white" />
    </div>
  ),
  info: (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-600 text-white">
      <span className="font-serif italic font-bold text-[11px] leading-none select-none">i</span>
    </div>
  ),
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  const content = (
    <>
      <style>{`
        @keyframes toastProgressDrain {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[100000] flex flex-col gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[380px] w-full pointer-events-none items-end"
      >
        {toasts.map((t) => {
          const styles = toastVariantStyles[t.variant];
          const duration = t.duration ?? 5000;

          return (
            <div
              key={t.id}
              role="alert"
              className={cn(
                "pointer-events-auto relative w-full rounded-xl sm:rounded-2xl bg-white p-4 pb-4.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-neutral-100/90 overflow-hidden transition-all",
                "animate-in slide-in-from-top-2 fade-in duration-200"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Left Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {toastIcons[t.variant]}
                </div>

                {/* Center Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <h4 className="text-[14px] font-bold text-neutral-900 tracking-[-0.01em] leading-snug">
                    {t.title}
                  </h4>
                  {t.description && (
                    <p className="mt-1 text-[13px] font-normal text-neutral-600 leading-relaxed break-words">
                      {t.description}
                    </p>
                  )}
                </div>

                {/* Right Close Button */}
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-1 text-neutral-400 hover:text-neutral-700 transition-colors rounded-md cursor-pointer -mr-1 -mt-0.5"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4 stroke-[1.5]" />
                </button>
              </div>

              {/* Bottom Progress Timer Bar */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[3.5px] w-full overflow-hidden",
                  styles.progressTrack
                )}
              >
                <div
                  className={cn("h-full origin-left", styles.progressBar)}
                  style={{
                    animation: `toastProgressDrain ${duration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return createPortal(content, document.body);
}

export { ToastProvider, useToast };
export type { Toast, ToastVariant };
