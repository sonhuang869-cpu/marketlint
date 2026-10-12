/**
 * The two markets this launch creates, and what each one must emit.
 *
 * Shopify Markets gives you a domain per market off one admin. What it does
 * not give you for free is correct hreflang reciprocity, per-market canonicals
 * and per-market Offer data. Those are the things that decide whether Google
 * treats the UK store as a separate market or as a duplicate of the German one.
 */

export type MarketId = 'de' | 'uk'

export type Market = {
  id: MarketId
  origin: string
  /** The hreflang value, which is a language tag, not a country. */
  hreflang: string
  htmlLang: string
  currency: 'EUR' | 'GBP'
  country: 'DE' | 'GB'
  label: string
}

export const MARKETS: Record<MarketId, Market> = {
  de: { id: 'de', origin: 'https://cold-beverages.com', hreflang: 'de-DE', htmlLang: 'de', currency: 'EUR', country: 'DE', label: 'Germany' },
  uk: { id: 'uk', origin: 'https://cold-beverages.co.uk', hreflang: 'en-GB', htmlLang: 'en-GB', currency: 'GBP', country: 'GB', label: 'United Kingdom' },
}

export const MARKET_LIST = [MARKETS.de, MARKETS.uk]

/** Handles stay the same across markets, so a page maps one to one. */
export type PageMap = { path: string; label: string; kind: 'home' | 'collection' | 'product' | 'page' | 'blog' }

export const PAGES: PageMap[] = [
  { path: '/', label: 'Home', kind: 'home' },
  { path: '/collections/all', label: 'All products', kind: 'collection' },
  { path: '/products/c-ld-lime', label: 'C°LD Lime', kind: 'product' },
  { path: '/products/probierpaket', label: 'Probierpaket', kind: 'product' },
  { path: '/pages/our-story', label: 'Our story', kind: 'page' },
  { path: '/blogs/news', label: 'News', kind: 'blog' },
]

/**
 * What the head of a given page should contain once both markets are live.
 * Every market gets a self-referencing tag, every market points at every other,
 * and x-default names the fallback. Miss any one of those and Google quietly
 * drops the cluster.
 */
export function expectedHead(path: string) {
  const alternates = MARKET_LIST.map(m => ({ hreflang: m.hreflang, href: m.origin + path }))
  return {
    alternates: [...alternates, { hreflang: 'x-default', href: MARKETS.de.origin + path }],
    canonicalFor: (m: Market) => m.origin + path,
  }
}

/** The Offer block for one product in one market. */
export function expectedOffer(m: Market, price: string, inStock: boolean) {
  return {
    '@type': 'Offer',
    price,
    priceCurrency: m.currency,
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    url: `${m.origin}/products/c-ld-lime`,
    // Google's merchant listing guidance asks for these two. Shopify themes
    // rarely emit them, and they are the difference between a plain result and
    // a result with price, stock and delivery shown.
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: m.country },
    },
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: m.country,
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
    },
  }
}
