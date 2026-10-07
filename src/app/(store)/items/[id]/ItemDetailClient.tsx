"use client";

import { useCustomerItem } from "@/features/customers/hooks/use-customer-catalog";
import { ItemView } from "@/features/items/components/storefront";
import { ItemViewSkeleton } from "@/features/items/components/storefront/ItemViewSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { RelatedItems } from "@/features/customers/components/catalog/RelatedItems";
import { categoryHref } from "@/features/customers/utils/catalog-listing-query";

export function ItemDetailClient({ itemId }: { itemId: string }) {
  const { data: item, isLoading, error, refetch } = useCustomerItem(itemId);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mt-6">
          <ItemViewSkeleton />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState message="Failed to load item" onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  if (!item) {
    return (
      <PageContainer>
        <ErrorState message="Item not found" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: "Shop All", href: "/products" },
          ...(item.category
            ? [{ label: item.category.name, href: categoryHref(item.category) }]
            : []),
          // No link to the Style: it would open a different Item. The shopper
          // goes back to the category listing to pick another one.
          { label: item.name },
        ]}
      />
      <div className="mt-6">
        <ItemView
          item={item}
          eyebrow={item.styleName}
          brandName={item.brand?.name}
          returnUrl={`/items/${item.id}`}
        />
      </div>
      <RelatedItems itemId={item.id} categoryId={item.category?.id} />
    </PageContainer>
  );
}
