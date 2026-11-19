import { requireAgentPage } from "@/features/agents/lib/page-context";
import { PageHeader } from "@/features/agents/components/shared";
import { PlaceOrderForm } from "@/features/agents/components/PlaceOrderForm";

export const metadata = { title: "Place Order" };

export default async function AgentPlaceOrderPage() {
  await requireAgentPage("/agent/place-order");
  return (
    <>
      <PageHeader
        title="Place Order"
        description="Order for one of your assigned customers, or for someone without an account. To buy for yourself, use Purchase Products."
      />
      <PlaceOrderForm />
    </>
  );
}
