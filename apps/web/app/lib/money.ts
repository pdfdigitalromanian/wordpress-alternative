/**
 * Deliberately NOT in commerce.server.ts: this is pure formatting logic
 * (no secrets, no Node-only APIs) used by route components on both
 * server (SSR) and client (hydration) — React Router's build refuses to
 * bundle any `.server.ts` import into client code regardless of which
 * export is actually used, so a formatter used by JSX has to live
 * outside the server-only module.
 *
 * Uses Medusa v2's decimal amount convention directly (verified against
 * a live instance: a variant priced at "10" in EUR is €10.00, not
 * €0.10) — never divide by 100.
 */
export function formatMoney(amount: number | null | undefined, currencyCode: string): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode.toUpperCase() }).format(amount);
  } catch {
    return `${amount} ${currencyCode.toUpperCase()}`;
  }
}
