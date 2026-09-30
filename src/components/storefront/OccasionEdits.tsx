import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Edit {
  slug: string;
  tag: string;
  title: string;
  description: string;
  href: string;
  gradient: string;
  image: string;
}

const EDITS: Edit[] = [
  {
    slug: "everyday",
    tag: "Daily Rotations",
    title: "Everyday Essentials",
    description: "Breathable fabrics and effortless silhouettes built for all-day wear.",
    href: "/products",
    gradient: "from-stone-400 via-stone-300 to-stone-200",
    image: "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "weekend",
    tag: "Outings & Getaways",
    title: "Weekend Style",
    description: "Smart-casual layers and vibrant tones for relaxed outings and travel.",
    href: "/products",
    gradient: "from-amber-700 via-amber-600 to-amber-500",
    image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "festive",
    tag: "Celebrations",
    title: "Festive Edit",
    description: "Traditional craftsmanship reimagined with contemporary cuts for celebratory events.",
    href: "/products",
    gradient: "from-slate-900 via-purple-950 to-slate-900",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
  },
];

export function OccasionEdits() {
  return (
    <section className="w-full bg-theme-primary-light/40">
      <div className="w-full max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1800px] mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-theme-primary">
            Curated Edits
          </span>
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-theme-text-primary">
            Made for Every Occasion
          </h2>
          <p className="mt-2 text-sm text-theme-text-subtle">
            From everyday essentials to special moments, discover styles that fit your life.
          </p>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EDITS.map((edit) => (
            <Link
              key={edit.slug}
              href={edit.href}
              className={`group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${edit.gradient} p-5`}
            >
              <Image
                src={edit.image}
                alt={edit.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              <div className="relative">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">
                  {edit.tag}
                </span>
                <h3 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-white">
                  {edit.title}
                </h3>
                <p className="mt-2 text-sm text-white/80">{edit.description}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-white group-hover:gap-2.5 transition-all">
                  Shop Now
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default OccasionEdits;
