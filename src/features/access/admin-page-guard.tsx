"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { firstAllowedAdminPath, permissionForAdminPath } from "@/lib/permissions/admin-routes";
import { useAdminAccess, useCan } from "./admin-access";

/**
 * Keeps a screen the role may not open from rendering, for someone who typed or
 * bookmarked the URL rather than using the sidebar. The APIs behind the screen are guarded
 * on the server as well, so this is about showing a clear message instead of a page full of
 * failed requests.
 */
export function AdminPageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const required = permissionForAdminPath(pathname);
  const { access, loading } = useAdminAccess();
  const allowed = useCan(required);
  const home = access.isOwner ? "/admin/dashboard" : firstAllowedAdminPath(access.permissions);
  const blocked = Boolean(required) && !loading && !allowed;

  // A role without DASHBOARD_VIEW still signs in at /admin/dashboard, so send it on to the
  // first screen it may open instead of greeting it with a refusal.
  React.useEffect(() => {
    if (blocked && pathname === "/admin/dashboard" && home && home !== pathname) {
      router.replace(home);
    }
  }, [blocked, pathname, home, router]);

  if (blocked) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">You don&apos;t have access to this page</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Your role is missing the <span className="font-mono text-xs">{required}</span> permission.
            Ask an administrator to add it under Team &amp; Access → Roles.
          </p>
          {home && (
          <Link
            href={home}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-theme-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Back to {home === "/admin/dashboard" ? "dashboard" : "your pages"}
          </Link>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
