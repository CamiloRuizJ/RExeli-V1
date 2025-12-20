/**
 * Stripe Client Configuration
 *
 * This file will be used to initialize the Stripe client once you have your API keys.
 *
 * Required Environment Variables (add to Vercel when ready):
 * - STRIPE_SECRET_KEY: Your Stripe secret key (sk_live_xxx or sk_test_xxx)
 * - STRIPE_WEBHOOK_SECRET: Your Stripe webhook signing secret (whsec_xxx)
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key (pk_live_xxx or pk_test_xxx)
 */

// Uncomment and use once Stripe is set up:
// import Stripe from 'stripe';

// Check if Stripe keys are configured
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}

// Get Stripe secret key with validation
function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    // Return placeholder during build or if not configured
    console.warn('STRIPE_SECRET_KEY not configured - Stripe features disabled');
    return 'stripe-not-configured';
  }

  return key;
}

// Stripe client instance (null if not configured)
// Uncomment when you install stripe package and have API keys:
/*
export const stripe = isStripeConfigured()
  ? new Stripe(getStripeSecretKey(), {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    })
  : null;
*/

// Placeholder until Stripe is configured
export const stripe = null;

// Stripe product/price IDs for your plans
// Update these with your actual Stripe product IDs when created
export const STRIPE_PLANS = {
  free: {
    name: 'Free',
    priceId: null, // Free tier - no Stripe price
    credits: 10,
    features: ['10 document credits', 'Basic support'],
  },
  basic: {
    name: 'Basic',
    priceId: process.env.STRIPE_PRICE_BASIC || null,
    credits: 100,
    features: ['100 document credits/month', 'Email support', 'Export to Excel'],
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || null,
    credits: 500,
    features: ['500 document credits/month', 'Priority support', 'All export formats', 'API access'],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    credits: -1, // Unlimited
    features: ['Unlimited documents', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
  },
} as const;

// Helper to get plan by price ID
export function getPlanByPriceId(priceId: string) {
  return Object.entries(STRIPE_PLANS).find(
    ([_, plan]) => plan.priceId === priceId
  )?.[0] as keyof typeof STRIPE_PLANS | undefined;
}

// Helper to get credits for a plan
export function getCreditsForPlan(planType: keyof typeof STRIPE_PLANS): number {
  return STRIPE_PLANS[planType]?.credits ?? 0;
}
