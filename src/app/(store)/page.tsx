import dynamic from "next/dynamic";

import {
  HeroIntro,
  ShopByCategory,
  PromoBanner,
  Features,
  OccasionEdits,
  Feedback,
  ProductGridSectionSkeleton,
  DealsSectionSkeleton,
  NewsletterSkeleton,
  LazyOfferPopup,
  LazyOfferReels,
} from "@/components/storefront";

// Below-the-fold, data-fetching sections are code-split from the initial
// bundle and stream in behind a skeleton sized to match their real layout,
// so nothing above them is blocked and no content jump happens once ready.
const ProductSection = dynamic(
  () => import("@/components/storefront/ProductSection"),
  {
    loading: () => (
      <ProductGridSectionSkeleton bgClassName="bg-theme-primary-light/40" />
    ),
  }
);

const TrendingNow = dynamic(
  () => import("@/components/storefront/TrendingNow"),
  {
    loading: () => <ProductGridSectionSkeleton withFilters />,
  }
);

const DealsSection = dynamic(
  () => import("@/components/storefront/DealsSection"),
  {
    loading: () => <DealsSectionSkeleton />,
  }
);

const Newsletter = dynamic(
  () => import("@/components/storefront/Newsletter"),
  {
    loading: () => <NewsletterSkeleton />,
  }
);

export default function HomePage() {
  return (
    <div className="bg-white">
      <LazyOfferPopup />
      <HeroIntro />
      <ShopByCategory />
      <ProductSection />
      <PromoBanner />
      <TrendingNow />
      <DealsSection />
      <LazyOfferReels />
      <Features />
      <OccasionEdits />
      <Feedback />
      <Newsletter />
    </div>
  );
}
