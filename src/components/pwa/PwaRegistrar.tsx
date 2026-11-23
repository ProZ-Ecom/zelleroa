"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export function PwaRegistrar() {
  const { addToast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Listen for new worker installed
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New update available
              addToast({
                variant: "info",
                title: "App update ready",
                description: "Refresh to use the latest version of Zellora.",
                duration: 6000,
              });
            }
          });
        });
      } catch (err) {
        console.warn("[PWA] Service Worker registration failed:", err);
      }
    };

    // Register when window is loaded to prevent render blocking
    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw);
      return () => window.removeEventListener("load", registerSw);
    }
  }, [addToast]);

  // Online / Offline network status notifications
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      addToast({
        variant: "warning",
        title: "You are offline",
        description: "Viewing cached pages. Full checkout requires internet.",
        duration: 5000,
      });
    };

    const handleOnline = () => {
      addToast({
        variant: "success",
        title: "Back online",
        description: "Your network connection has been restored.",
        duration: 4000,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addToast]);

  return null;
}
