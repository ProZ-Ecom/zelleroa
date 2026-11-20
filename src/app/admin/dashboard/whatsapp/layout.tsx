import { notFound } from "next/navigation";
import { isWhatsAppModuleEnabled } from "@/lib/whatsapp/whatsapp-config";

export default function WhatsAppAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isWhatsAppModuleEnabled()) {
    notFound();
  }

  return <>{children}</>;
}
