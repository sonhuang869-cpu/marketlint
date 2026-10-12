/**
 * The checks. Each one is a rule a multi-market Shopify launch can fail, and
 * each is written so it can be run against a real page capture rather than
 * described in a slide.
 */

import { MARKET_LIST, MARKETS, expectedHead, type Market } from './markets'

export type Alternate = { lang: string; href: string }

export type PageCapture = {
  path: string
  status: number
  title: string
  titleLen: number
  lang: string
  canonical: string | null
  hreflang: Alternate[]
  ogLocale: string | null
  metaDescLen: number
  h1Count: number
  schemaTypes: string[]
  product: null | {
    name: string
    sku: string | null
    gtin: string | null
    brand: string | null
    images: number
    hasReturnPolicy: boolean
    hasShippingDetails: boolean
    offer: null | { price: string; currency: string; availability: string; validUntil: string | null; url: string | null }
  }
}

export type Severity = 'blocker' | 'warning' | 'ok'

export type Finding = {
  id: string
  severity: Severity
  title: string
  detail: string
  /** Why it matters once a second market exists, not in general. */
  consequence: string
}

const alt = (p: PageCapture, lang: string) => p.hreflang.find(h => h.lang.toLowerCase() === lang.toLowerCase())

export function checkPage(p: PageCapture, market: Market, siblings: MarketAware[]): Finding[] {
  const out: Finding[] = []
  const expect = expectedHead(p.path)

  // 1. self-referencing hreflang
  if (!alt(p, market.hreflang)) {
    out.push({
      id: 'hreflang-self',
      severity: 'blocker',
      title: `No self-referencing hreflang for ${market.hreflang}`,
      detail: `This page should declare itself as ${market.hreflang} pointing at ${market.origin}${p.path}.`,
      consequence: 'Without a self reference the cluster is incomplete and Google ignores the whole set, not just the missing tag.',
    })
  }

  // 2. a tag for every other market
  for (const other of MARKET_LIST.filter(m => m.id !== market.id)) {
    if (!alt(p, other.hreflang)) {
      out.push({
        id: `hreflang-${other.id}`,
        severity: 'blocker',
        title: `No hreflang pointing at ${other.label}`,
        detail: `Expected ${other.hreflang} to point at ${other.origin}${p.path}.`,
        consequence: `The ${other.label} page becomes a duplicate of this one rather than its market equivalent.`,
      })
    }
  }

  // 3. x-default
  if (!alt(p, 'x-default')) {
    out.push({
      id: 'hreflang-xdefault',
      severity: 'warning',
      title: 'No x-default',
      detail: `Expected x-default to point at ${expect.alternates.find(a => a.hreflang === 'x-default')!.href}.`,
      consequence: 'Visitors outside both markets get whichever version Google guesses, which is usually the German one.',
    })
  }

  // 4. reciprocity: the other market must point back
  for (const sib of siblings) {
    if (sib.market.id === market.id) continue
    const here = alt(p, sib.market.hreflang)
    const back = sib.page ? alt(sib.page, market.hreflang) : undefined
    if (here && !back) {
      out.push({
        id: 'hreflang-reciprocity',
        severity: 'blocker',
        title: `${sib.market.label} does not point back`,
        detail: `This page claims ${sib.market.hreflang} but that page does not declare ${market.hreflang}.`,
        consequence: 'A one-way hreflang is discarded. Both sides have to agree or neither counts.',
      })
    }
  }

  // 5. canonical must point at this market, not the other one
  if (!p.canonical) {
    out.push({ id: 'canonical-missing', severity: 'blocker', title: 'No canonical', detail: 'This page declares no canonical URL.', consequence: 'Two markets serving near-identical English and German pages need an explicit canonical each.' })
  } else {
    const cross = MARKET_LIST.find(m => m.id !== market.id && p.canonical!.startsWith(m.origin))
    if (cross) {
      out.push({ id: 'canonical-cross-market', severity: 'blocker', title: `Canonical points at ${cross.label}`, detail: `Canonical is ${p.canonical}.`, consequence: 'This hands all ranking signal to the other market and removes this one from the index.' })
    }
  }

  // 6. html lang
  if (!p.lang || p.lang.toLowerCase() !== market.htmlLang.toLowerCase()) {
    out.push({ id: 'html-lang', severity: 'warning', title: `html lang is "${p.lang || 'empty'}", expected "${market.htmlLang}"`, detail: 'The document language should match the market.', consequence: 'Mismatched lang confuses translation prompts and assistive technology.' })
  }

  // 7. product specifics
  if (p.product) {
    const o = p.product.offer
    if (!o) {
      out.push({ id: 'offer-missing', severity: 'blocker', title: 'Product schema has no Offer', detail: 'A Product without an Offer cannot show price or stock in search.', consequence: 'No merchant listing, no price, no availability in the result.' })
    } else {
      if (o.currency !== market.currency) {
        out.push({ id: 'offer-currency', severity: 'blocker', title: `Offer currency is ${o.currency}, expected ${market.currency}`, detail: `The ${market.label} market must publish prices in ${market.currency}.`, consequence: 'A UK shopper is shown euros in the search result and bounces at the click.' })
      }
      if (!o.url || !o.url.startsWith(market.origin)) {
        out.push({ id: 'offer-url', severity: 'warning', title: 'Offer URL points at the wrong market', detail: `Offer url is ${o.url ?? 'absent'}.`, consequence: 'Google follows the offer URL, so the wrong market gets the click.' })
      }
    }
    if (!p.product.hasShippingDetails) {
      out.push({ id: 'shipping-details', severity: 'warning', title: 'No shippingDetails on the Offer', detail: 'Google asks for delivery cost and destination to show a merchant listing.', consequence: 'The result loses the delivery line that competitors with it will show.' })
    }
    if (!p.product.hasReturnPolicy) {
      out.push({ id: 'return-policy', severity: 'warning', title: 'No hasMerchantReturnPolicy', detail: 'Returns window and country are part of the merchant listing fields.', consequence: 'Same as above: a thinner result than it needs to be.' })
    }
    if (!p.product.gtin && !p.product.sku) {
      out.push({ id: 'product-id', severity: 'warning', title: 'No GTIN or SKU in the schema', detail: 'Neither identifier is published.', consequence: 'Harder for Google to match the product across the two markets and to merchant feeds.' })
    }
  }

  // 8. basic hygiene that a new market inherits
  if (p.h1Count !== 1) {
    out.push({ id: 'h1', severity: 'warning', title: `${p.h1Count} h1 elements`, detail: 'Each page should have exactly one h1.', consequence: 'Whatever is wrong here is copied into the second market when the theme is duplicated.' })
  }
  if (p.metaDescLen === 0) {
    out.push({ id: 'meta-desc', severity: 'warning', title: 'No meta description', detail: 'This page publishes no description.', consequence: 'Google writes its own, in German, and the UK page inherits the same gap.' })
  }

  return out
}

export type MarketAware = { market: Market; page: PageCapture | null }

export const severityRank: Record<Severity, number> = { blocker: 0, warning: 1, ok: 2 }

export function summarise(findings: Finding[]) {
  return {
    blockers: findings.filter(f => f.severity === 'blocker').length,
    warnings: findings.filter(f => f.severity === 'warning').length,
  }
}

export { MARKETS }
