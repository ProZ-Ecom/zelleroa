"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ACCOUNT_BLOCKED_EVENT } from "@/lib/api/account-blocked";
import { logoutApi } from "@/features/auth/api/auth.api";
import { clearAuthStorage } from "@/features/auth/hooks/use-auth-mutations";

export const ACCOUNT_BLOCKED_MODAL_TITLE = "Account Blocked";
export const ACCOUNT_BLOCKED_MODAL_MESSAGE =
  "Your account has been blocked by the administrator. You have been logged out. Please contact support for assistance.";

/**
 * Global handler for a customer blocked while signed in. Mounted once in the
 * app providers: on the first ACCOUNT_BLOCKED event it ends the session
 * (cookies, NextAuth state, query cache, stored auth data), shows the modal and,
 * on OK, hard-redirects to the login page.
 */
export function AccountBlockedGate() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(true);
  const started = React.useRef(false);

  const endSession = React.useCallback(async () => {
    try {
      // Expires the JWT + Auth.js cookies server-side.
      await logoutApi();
    } catch {
      // The account is blocked regardless; continue clearing client state.
    }
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    clearAuthStorage();
    setLoggingOut(false);
  }, [queryClient]);

  React.useEffect(() => {
    const onBlocked = () => {
      if (started.current) return;
      started.current = true;
      setOpen(true);
      void endSession();
    };
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked);
  }, [endSession]);

  const goToLogin = () => {
    if (loggingOut) return;
    // replace() drops the protected page from history so Back can't return to it.
    window.location.replace(
      window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login"
    );
  };

  return (
    <Modal open={open} onClose={goToLogin} className="[&>button]:hidden">
      <div
        role="alertdialog"
        aria-labelledby="account-blocked-title"
        aria-describedby="account-blocked-desc"
        className="flex flex-col items-center text-center"
      >
        <div className="rounded-full p-3 mb-4 bg-red-50 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3
          id="account-blocked-title"
          className="text-lg font-bold text-neutral-900 mb-2 tracking-tight"
        >
          {ACCOUNT_BLOCKED_MODAL_TITLE}
        </h3>
        <p
          id="account-blocked-desc"
          className="text-sm text-neutral-500 mb-6 max-w-sm leading-relaxed"
        >
          {ACCOUNT_BLOCKED_MODAL_MESSAGE}
        </p>
        {loggingOut ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500" role="status">
            <Spinner size="sm" />
            Logging you out…
          </div>
        ) : (
          <Button className="w-full rounded-xl font-semibold cursor-pointer" onClick={goToLogin}>
            OK
          </Button>
        )}
      </div>
    </Modal>
  );
}
