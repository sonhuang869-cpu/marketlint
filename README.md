# Marketlint

A multi-market readiness audit of a live Shopify store, run against the rules a
second market actually has to pass.

Built for a brief to turn a German Shopify store into a multi-market store with
a UK domain, where the client said strong SEO foundations and properly
implemented product schema were essential.

## It audits the real store

Six pages were read from the live site on 12 October 2026 and the capture is
committed in `src/lib/capture.json`. Nothing here is a mock-up or a template
audit.

**The finding: not one hreflang tag exists, on any of the six pages.** That is
fine for one market and fatal for two. The tags have to be live on both domains
the day the second one opens, because the window where the UK pages exist and
the German pages do not point at them is the window Google reads them as
duplicates of each other.

**What is already right, and it is most of it.** Both product pages carry
Product schema with SKU, GTIN13, brand, a complete Offer and `shippingDetails`,
which many Shopify themes never emit. Availability reads `OutOfStock` and the
catalogue genuinely is sold out, so the schema matches the shop rather than
contradicting it. Every page declares a canonical and none points at another
domain, so nothing has to be unpicked. The only schema field missing is
`hasMerchantReturnPolicy`.

Writing that down mattered. The first pass of this audit claimed the shipping
and identifier fields were missing. The assertion failed against the captured
data, and the data was right.

## The rules

`src/lib/rules.ts` holds the checks, each one a way a multi-market launch fails:
self-referencing hreflang, a tag per market, `x-default`, **reciprocity**,
canonical pointing at its own market rather than across, `html lang`, Offer
currency matching the market, Offer URL matching the market, and the merchant
listing fields.

Reciprocity is the one worth singling out. A one-way hreflang is discarded
entirely, so the test constructs a German page pointing at a silent UK page and
asserts it is caught, then makes the pair reciprocal and asserts it passes.

## The two views

The page runs the same rules twice: against the store as captured, and against a
head that has been corrected. Today, 12 blockers and 8 warnings. After, both
markets pass. The market toggle shows what changes between domains and what does
not: the hreflang set is identical on both, the canonical and the Offer currency
are not. Getting that the wrong way round is the most common way a second market
disappears from the index.

## Running it

```
npm install
npm run dev
```

## Scope

This audits publicly served pages. No access to the store was used or needed.
Prices and stock were correct at capture and will have moved since.
