"use client";

import { useCustomerStyle } from "@/features/customers/hooks/use-customer-catalog";
import { StyleView } from "@/features/styles/components/storefront";
import { StyleViewSkeleton } from "@/features/styles/components/storefront/StyleViewSkeleton";
import { ErrorState } from "@/components/ui/error-state";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { RelatedItems } from "@/features/customers/components/catalog/RelatedItems";
import { categoryHref } from "@/features/customers/utils/catalog-listing-query";
import { styleHref } from "@/features/customers/utils/style-href";

/**
 * The storefront product page. A Style is the lowest level the shopper sees:
 * it owns the Colours, and each Colour its own Sizes, prices and stock.
 */
export function StyleDetailClient({
  slug,
  notFoundMessage = "Style not found",
}: {
  slug: string;
  notFoundMessage?: string;
}) {
  const { data: style, isLoading, error, refetch } = useCustomerStyle(slug);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mt-6">
          <StyleViewSkeleton />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState message="Failed to load this product" onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  if (!style) {
    return (
      <PageContainer>
        <ErrorState message={notFoundMessage} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: "Shop All", href: "/products" },
          ...(style.category
            ? [{ label: style.category.name, href: categoryHref(style.category) }]
            : []),
          { label: style.name },
        ]}
      />
      <div className="mt-6">
        <StyleView
          style={style}
          eyebrow={style.product.name}
          brandName={style.brand?.name}
          returnUrl={styleHref(style.id)}
        />
      </div>
      <RelatedItems styleId={style.id} categoryId={style.category?.id} />
    </PageContainer>
  );
}
