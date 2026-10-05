"use client";

import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/common/dropdown";
import { useSession } from "next-auth/react";
import { useLogout } from "@/features/auth/hooks/use-auth-mutations";
import { getInitials } from "@/lib/utils";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const { data: session } = useSession();

  const logout = useLogout("/admin/login");
  const handleLogout = () => {
    if (logout.isPending) return;
    logout.mutate();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 lg:hidden">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-hanken text-secondary-600 text-lg font-semibold">Admin Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-neutral-600">
          <Bell className="h-5 w-5" />
        </Button>

        <Dropdown
          trigger={
            <Button variant="ghost" className="flex items-center gap-2">
              <div className="bg-secondary-600 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white">
                {session?.user?.name ? getInitials(session.user.name) : "A"}
              </div>
              <span className="hidden text-sm md:inline">{session?.user?.name || "Admin"}</span>
            </Button>
          }
        >
          <DropdownItem onClick={handleLogout}>
            Logout
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}

export { AdminHeader };
