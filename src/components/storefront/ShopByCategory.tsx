import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CategoryCard {
  slug: string;
  name: string;
  subtitle: string;
  tag: string;
  image: string;
  href?: string;
  cta?: string;
  comingSoon?: boolean;
}

const CATEGORIES: CategoryCard[] = [
  { slug: "men", name: "Men", subtitle: "Shirts • T-Shirts • Jeans", image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=600&q=80", tag: "Collection", href: "/products?gender=men", cta: "Explore" },
  { slug: "women", name: "Women", subtitle: "Dresses • Tops • Ethnic", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80", tag: "Collection", href: "/products?gender=women", cta: "Explore" },
  { slug: "kids", name: "Kids", subtitle: "Boys • Girls • Baby", image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=600&q=80", tag: "Collection", href: "/products?gender=kids", cta: "Explore" },
  { slug: "accessories", name: "Accessories", subtitle: "Bags • Watches • Shoes", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80", tag: "Collection", href: "/products", cta: "Explore" },
  { slug: "electronics", name: "Electronics", subtitle: "Audio • Wearables • Smart", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80", tag: "Ecosystem", comingSoon: true, cta: "Pre-launch alerts ready" },
  { slug: "home-living", name: "Home Living", subtitle: "Decors • Bedding • Kitchen", image: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=600&q=80", tag: "Living", comingSoon: true, cta: "Curations dropping soon" },
];

export function ShopByCategory() {
  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-theme-primary">
              Collections &amp; More
            </span>
            <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
              Shop By Category
            </h2>
            <p className="mt-2 text-sm text-theme-text-subtle">
              Find something perfect for every style, every day.
            </p>
          </div>

          <Link
            href="/products"
            className="flex items-center gap-1.5 text-sm font-semibold text-theme-primary hover:text-theme-primary-hover transition-colors"
          >
            Browse Complete Catalog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((category) => {
            const CardInner = (
              <>
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800">
                  <Image
                    src={category.image}
                    alt={`${category.name} collection`}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {category.comingSoon && (
                    <span className="absolute left-2.5 top-2.5 z-10 rounded bg-theme-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                      Coming Soon
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      {category.tag}
                    </span>
                    <span className="block text-lg font-extrabold uppercase tracking-tight text-white">
                      {category.name}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5">
                  <p className="text-xs text-theme-text-subtle truncate">{category.subtitle}</p>
                  {category.comingSoon ? (
                    <p className="mt-0.5 text-xs italic text-theme-text-subtle">{category.cta}</p>
                  ) : (
                    <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-theme-primary">
                      {category.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </>
            );

            if (category.comingSoon || !category.href) {
              return (
                <div key={category.slug} className="group">
                  {CardInner}
                </div>
              );
            }

            return (
              <Link key={category.slug} href={category.href} className="group">
                {CardInner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ShopByCategory;
