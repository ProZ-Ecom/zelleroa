/**
 * Where a Style link lands. A Style is the lowest level the storefront shows:
 * it owns the Colours and their Sizes, so `/styles/:styleId` is the one
 * product page, and a link that names only a Product (`/products/:styleId`)
 * resolves to the Style it was built from.
 */
export const styleHref = (styleId: string) => `/styles/${encodeURIComponent(styleId)}`;
