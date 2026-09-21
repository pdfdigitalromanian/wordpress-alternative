import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Stripe TEST-mode payment provider — registered ONLY when STRIPE_API_KEY
// is actually set, so a checkout without it configured shows a precise
// "test payment not configured" state in the CMS storefront instead of
// this backend failing to boot. No live/production Stripe key should
// ever go here; this is a test-mode integration, not a production one.
//
// Resolve path verified directly against the installed package tree
// (not copied from docs unchecked): @medusajs/medusa@2.21.0 has no
// "./payment" or "./payment-stripe" export subpath at all (checked its
// package.json `exports` map and root directory listing), so the
// "@medusajs/medusa/payment-stripe" form some current docs show does not
// resolve against this pinned version. @medusajs/payment@2.21.0 and
// @medusajs/payment-stripe@2.21.0 ARE both real, correctly-versioned,
// independently resolvable packages already present in this project's
// dependency tree — that's the form used here instead.
//
// Resulting Store API provider_id will be "pp_stripe_stripe" (Medusa's
// <configured id>_<provider identifier> convention — the identifier
// "stripe" is fixed by @medusajs/payment-stripe itself, confirmed by
// reading its compiled source).
const stripeApiKey = process.env.STRIPE_API_KEY
const modules = stripeApiKey
  ? [
      {
        resolve: '@medusajs/payment',
        options: {
          providers: [
            {
              resolve: '@medusajs/payment-stripe',
              id: 'stripe',
              options: {
                apiKey: stripeApiKey,
                // Webhook signature verification uses this — required
                // for the webhook route to accept real Stripe events at
                // all, not optional hardening.
                webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    workerMode: (process.env.MEDUSA_WORKER_MODE as 'shared' | 'server' | 'worker' | undefined) ?? 'shared',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
  },
  modules,
})
