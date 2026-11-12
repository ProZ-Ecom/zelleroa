"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setSidebarCollapsed(true);
    document.body.classList.add("admin-body");
    return () => {
      document.body.classList.remove("admin-body");
    };
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="admin-body flex h-screen overflow-hidden">
      <AdminSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col">{children}</main>
      </div>
    </div>
  );
}

export { AdminLayout };
