import { useMemo, useState } from 'react'
import { AlertTriangle, Check, XCircle } from 'lucide-react'
import capture from './lib/capture.json'
import { checkPage, summarise, type Finding, type PageCapture } from './lib/rules'
import { MARKETS, MARKET_LIST, expectedHead, expectedOffer, type MarketId } from './lib/markets'

const PAGES = (capture as { pages: PageCapture[] }).pages
const CAPTURED = (capture as { capturedAt: string }).capturedAt.slice(0, 10)

function Code({ children, label, wrap }: { children: string; label?: string; wrap?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-dark">
      {label && (
        <figcaption className="border-b border-white/10 px-4 py-2 mono text-[0.7rem] text-[#8A97A6]">{label}</figcaption>
      )}
      {/* URLs are the point of these blocks, so they wrap rather than scroll
          out of sight behind an edge nobody notices. */}
      <pre className={`px-4 py-3.5 mono text-[12px] leading-[1.7] text-[#CBD5E1] ${wrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto'}`}>
        {children}
      </pre>
    </figure>
  )
}

const TONE = {
  blocker: { cls: 'bg-blocker-soft text-blocker', Icon: XCircle },
  warning: { cls: 'bg-warn-soft text-warn', Icon: AlertTriangle },
  ok: { cls: 'bg-pass-soft text-pass', Icon: Check },
} as const

export default function App() {
  const [market, setMarket] = useState<MarketId>('uk')
  const [after, setAfter] = useState(false)

  // Today's findings come from the real capture. The "after" column is the same
  // rules run against a head that has been corrected, so the two are comparable.
  const today = useMemo<Finding[]>(
    () => PAGES.flatMap(p => checkPage(p, MARKETS.de, [{ market: MARKETS.de, page: p }, { market: MARKETS.uk, page: null }])),
    [],
  )

  const fixed = useMemo<Finding[]>(() => {
    const head = (path: string) => expectedHead(path).alternates.map(a => ({ lang: a.hreflang, href: a.href }))
    return PAGES.flatMap(p => {
      const de: PageCapture = { ...p, hreflang: head(p.path), lang: 'de', canonical: MARKETS.de.origin + p.path,
        product: p.product ? { ...p.product, hasReturnPolicy: true } : null }
      const uk: PageCapture = { ...de, lang: 'en-GB', canonical: MARKETS.uk.origin + p.path,
        product: p.product ? { ...p.product, hasReturnPolicy: true,
          offer: p.product.offer ? { ...p.product.offer, currency: 'GBP', url: MARKETS.uk.origin + p.path } : null } : null }
      return [
        ...checkPage(de, MARKETS.de, [{ market: MARKETS.de, page: de }, { market: MARKETS.uk, page: uk }]),
        ...checkPage(uk, MARKETS.uk, [{ market: MARKETS.uk, page: uk }, { market: MARKETS.de, page: de }]),
      ]
    })
  }, [])

  const shown = after ? fixed : today
  const sum = summarise(shown)

  const grouped = useMemo(() => {
    const m = new Map<string, { f: Finding; n: number }>()
    for (const f of shown) {
      const e = m.get(f.id)
      if (e) e.n++
      else m.set(f.id, { f, n: 1 })
    }
    return [...m.values()].sort((a, b) => (a.f.severity === b.f.severity ? b.n - a.n : a.f.severity === 'blocker' ? -1 : 1))
  }, [shown])

  const m = MARKETS[market]
  const hreflangBlock = expectedHead('/products/c-ld-lime').alternates
    .map(a => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n')
  const canonical = `<link rel="canonical" href="${m.origin}/products/c-ld-lime" />`
  const offer = JSON.stringify(expectedOffer(m, m.currency === 'GBP' ? '12.99' : '14.29', true), null, 2)

  const productPages = PAGES.filter(p => p.product)

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">Skip to content</a>

      <header className="border-b border-line bg-card">
        <div className="shell flex h-14 items-center justify-between">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#10171F" />
              <path d="M8 16h5l3-6 3 12 3-6h2" fill="none" stroke="#1E8FA3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-semibold tracking-[-0.02em]">Marketlint</span>
          </span>
          <span className="mono text-xs text-muted">captured {CAPTURED}</span>
        </div>
      </header>

      <main id="main">
        <section className="shell py-12 md:py-16">
          <p className="label text-brand">Multi-market readiness</p>
          <h1 className="h1 mt-3 max-w-3xl">Your German store, checked against what a UK market actually needs.</h1>
          <p className="mt-5 max-w-2xl text-base text-ink-2">
            This is not a template audit. Every row below was read from the live pages at
            <span className="mono text-ink"> cold-beverages.com</span> on {CAPTURED}, then run through the
            rules a <span className="mono text-ink">de-DE</span> plus <span className="mono text-ink">en-GB</span> launch has to pass.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-4">
            {[
              ['Pages read', String(PAGES.length)],
              ['hreflang tags found', '0'],
              ['Blockers today', String(summarise(today).blockers)],
              ['Warnings today', String(summarise(today).warnings)],
            ].map(([k, v]) => (
              <div key={k} className="card p-4">
                <p className="label">{k}</p>
                <p className="mono mt-1 text-2xl font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div className="card mt-6 border-pass/40 bg-pass-soft p-5">
            <h2 className="h3 flex items-center gap-2"><Check className="size-4 text-pass" aria-hidden="true" /> What is already right</h2>
            <p className="mt-2 text-sm text-ink-2">
              Both product pages carry Product schema with SKU, GTIN13, brand, a complete Offer and
              <span className="mono"> shippingDetails</span>, which most Shopify themes never emit. Availability reads
              <span className="mono"> OutOfStock</span>, and the catalogue genuinely is sold out, so the schema matches the shop
              rather than contradicting it. Every page declares a canonical, and none points at another domain, so nothing
              has to be unpicked. The schema groundwork is largely done.
            </p>
          </div>
        </section>

        <section aria-labelledby="pages" className="border-t border-line bg-card">
          <div className="shell py-12 md:py-14">
            <h2 id="pages" className="h2">What each page publishes today</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Page', 'Status', 'hreflang', 'Canonical', 'Schema'].map((h, i) => (
                      <th key={h} scope="col" className={`label py-2.5 pr-4 font-semibold ${i > 1 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PAGES.map(p => (
                    <tr key={p.path}>
                      <th scope="row" className="mono py-3 pr-4 text-left text-xs font-normal">{p.path}</th>
                      <td className="mono py-3 pr-4 text-xs">{p.status}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className="mono rounded bg-blocker-soft px-2 py-0.5 text-xs font-semibold text-blocker">{p.hreflang.length}</span>
                      </td>
                      <td className="py-3 pr-4 text-right"><Check className="ml-auto size-4 text-pass" aria-label="present" /></td>
                      <td className="mono py-3 text-right text-xs text-muted">{p.schemaTypes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted">
              Zero in every row of that third column is the finding. One market does not need hreflang. Two do, and the
              tags have to exist on both sides before the second domain goes live, not after.
            </p>
          </div>
        </section>

        <section aria-labelledby="findings" className="shell py-12 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="findings" className="h2">Findings</h2>
              <p className="mt-1 text-sm text-muted">The same rules, run twice.</p>
            </div>
            <div className="flex rounded-lg border border-field p-0.5">
              {[['Today', false], ['After the fix', true]].map(([label, v]) => (
                <button key={String(label)} type="button" onClick={() => setAfter(v as boolean)} aria-pressed={after === v}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${after === v ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper'}`}>
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          <p className="mono mt-5 text-sm">
            <span className={sum.blockers ? 'text-blocker' : 'text-pass'}>{sum.blockers} blockers</span>
            <span className="text-muted"> · </span>
            <span className={sum.warnings ? 'text-warn' : 'text-pass'}>{sum.warnings} warnings</span>
            <span className="text-muted"> across {after ? PAGES.length * 2 : PAGES.length} page checks</span>
          </p>

          {grouped.length === 0 ? (
            <div className="card mt-6 border-pass/40 bg-pass-soft p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-pass">
                <Check className="size-4" aria-hidden="true" /> Both markets pass every rule.
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-3">
              {grouped.map(({ f, n }) => {
                const t = TONE[f.severity]
                return (
                  <li key={f.id} className="card p-5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${t.cls}`}>
                        <t.Icon className="size-3.5" aria-hidden="true" />{f.severity}
                      </span>
                      <h3 className="h3">{f.title}</h3>
                      <span className="mono text-xs text-muted">x{n}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{f.detail}</p>
                    <p className="mt-1.5 text-sm text-muted"><span className="font-medium text-ink-2">Why it matters: </span>{f.consequence}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="fix" className="border-t border-line bg-card">
          <div className="shell py-12 md:py-16">
            <h2 id="fix" className="h2">What goes in the head</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-2">
              The same block on both domains, on every page, with the handle unchanged. Switch market to see what changes
              and what does not.
            </p>

            <div className="mt-6 flex rounded-lg border border-field p-0.5 w-fit">
              {MARKET_LIST.map(x => (
                <button key={x.id} type="button" onClick={() => setMarket(x.id)} aria-pressed={market === x.id}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${market === x.id ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper'}`}>
                  {x.label} <span className="mono">{x.hreflang}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="grid gap-5">
                <Code label="identical on both domains" wrap>{hreflangBlock}</Code>
                <Code label={`canonical, ${m.label} only`} wrap>{canonical}</Code>
                <p className="text-sm text-muted">
                  The hreflang set never changes between markets. The canonical always does. Getting that the wrong way
                  round is the single most common way a second market disappears from the index.
                </p>
              </div>
              <Code label={`Offer for ${m.label}, ${m.currency}`}>{offer}</Code>
            </div>

            <div className="card mt-8 p-5">
              <h3 className="h3">The two product pages, as they stand</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Product', 'SKU', 'GTIN', 'Price', 'Availability', 'Return policy'].map(h => (
                        <th key={h} scope="col" className="label py-2 pr-4 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {productPages.map(p => (
                      <tr key={p.path}>
                        <th scope="row" className="py-2.5 pr-4 text-left font-medium">{p.product!.name}</th>
                        <td className="mono py-2.5 pr-4 text-xs">{p.product!.sku}</td>
                        <td className="mono py-2.5 pr-4 text-xs">{p.product!.gtin}</td>
                        <td className="mono py-2.5 pr-4 text-xs">{p.product!.offer!.price} {p.product!.offer!.currency}</td>
                        <td className="mono py-2.5 pr-4 text-xs">{p.product!.offer!.availability.split('/').pop()}</td>
                        <td className="py-2.5"><span className="mono rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">missing</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-dark text-white">
          <div className="shell py-12 md:py-16">
            <h2 className="h2">Against a 9 November launch</h2>
            <p className="mt-4 max-w-2xl text-base" style={{ color: '#AEB9C6' }}>
              The hreflang work is small and it is not the risk. The risk is sequencing: the tags have to be live on both
              domains the day the UK store opens, because the window where the UK pages exist and the German pages do not
              point at them is the window Google reads them as duplicates. That ordering is a theme change plus a
              deploy, not a project.
            </p>
            <p className="mt-4 max-w-2xl text-base" style={{ color: '#AEB9C6' }}>
              The catalogue is six products and a deposit line. The schema is already strong. What actually needs
              care is the 3PL routing and the theme replicating the German store, and those are where the hours should go.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-7">
        <div className="shell">
          <p className="text-xs text-muted">
            Audit of publicly served pages at cold-beverages.com, captured {CAPTURED}. No access to the store was used or
            needed. Prices and stock were correct at capture and will have moved since.
          </p>
        </div>
      </footer>
    </div>
  )
}
