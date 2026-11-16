import type { Metadata } from "next";
import type { ReactNode } from "react";
import AuthBanner from "@/components/auth/AuthBanner";
import { constructMetadata } from "@/lib/seo";

export const metadata: Metadata = constructMetadata({
  title: "Account Authentication",
  noIndex: true,
});

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid h-screen w-full overflow-hidden lg:grid-cols-[45%_55%]">
      {/* Left Banner - strictly fixed & non-scrollable on desktop */}
      <div className="hidden h-screen min-h-0 w-full overflow-hidden lg:block">
        <AuthBanner />
      </div>

      {/* Right Side - independently scrollable */}
      <main className="h-screen min-h-0 w-full overflow-y-auto bg-background">
        <div className="flex min-h-full w-full items-center justify-center px-4 py-8 sm:px-6 md:px-8 lg:px-10">
          <div className="my-auto w-full max-w-[520px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
