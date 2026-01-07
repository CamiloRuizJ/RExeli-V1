/**
 * Stripe Configuration
 *
 * Centralized pricing configuration for Stripe integration.
 * Contains price IDs (to be filled when Stripe products are created)
 * and pricing constants used throughout the application.
 */

/**
 * Stripe Price IDs
 * These will be populated when Stripe products/prices are created in the dashboard.
 * Format: price_XXXXXXXXXXXXX
 */
export const STRIPE_PRICE_IDS = {
  // Monthly subscriptions
  entrepreneur_monthly: process.env.STRIPE_PRICE_ENTREPRENEUR_MONTHLY || '',
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',

  // Annual subscriptions
  entrepreneur_annual: process.env.STRIPE_PRICE_ENTREPRENEUR_ANNUAL || '',
  professional_annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || '',
  business_annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '',

  // One-time purchases
  one_time_starter: process.env.STRIPE_PRICE_STARTER || '',
  one_time_basic: process.env.STRIPE_PRICE_BASIC || '',
  one_time_standard: process.env.STRIPE_PRICE_STANDARD || '',
  one_time_pro: process.env.STRIPE_PRICE_PRO || '',
  one_time_enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
} as const;

/**
 * Subscription pricing configuration
 * All amounts in USD
 */
export const SUBSCRIPTION_PRICING = {
  entrepreneur: {
    monthly: 15,
    annual: 165,        // 1 month free ($15 * 11)
    pages: 250,
    users: 1,
    extraPagePrice: 0.10,
  },
  professional: {
    monthly: 89,
    annual: 979,        // 1 month free ($89 * 11)
    pages: 1500,
    users: 3,
    extraPagePrice: 0.08,
  },
  business: {
    monthly: 349,
    annual: 3839,       // 1 month free ($349 * 11)
    pages: 7500,
    users: 10,
    extraPagePrice: 0.06,
  },
  enterprise: {
    monthly: null,      // Custom pricing
    annual: null,       // Custom pricing
    pages: 50000,
    users: 999,         // Unlimited
    extraPagePrice: null, // Negotiated
  },
} as const;

/**
 * One-time purchase pricing configuration
 * Credits never expire
 */
export const ONE_TIME_PRICING = {
  starter: {
    price: 8,
    pages: 50,
    pricePerPage: 0.16,
  },
  basic: {
    price: 20,
    pages: 150,
    pricePerPage: 0.13,
  },
  standard: {
    price: 55,
    pages: 500,
    pricePerPage: 0.11,
  },
  pro: {
    price: 135,
    pages: 1500,
    pricePerPage: 0.09,
  },
  enterprise: {
    price: 400,
    pages: 5000,
    pricePerPage: 0.08,
  },
} as const;

/**
 * Group subscription pricing (for teams)
 * Based on the group subscription types
 */
export const GROUP_PRICING = {
  professional: {
    monthly: 89,
    annual: 979,
    pages: 1500,
    maxMembers: 3,
  },
  business: {
    monthly: 349,
    annual: 3839,
    pages: 7500,
    maxMembers: 10,
  },
  enterprise: {
    monthly: null,      // Custom
    annual: null,       // Custom
    pages: 50000,
    maxMembers: 999,
  },
} as const;

/**
 * Helper to get subscription type from Stripe price ID
 */
export function getSubscriptionTypeFromPriceId(priceId: string): string | null {
  for (const [key, value] of Object.entries(STRIPE_PRICE_IDS)) {
    if (value === priceId) {
      return key;
    }
  }
  return null;
}

/**
 * Helper to get price ID from subscription type
 */
export function getPriceIdFromSubscriptionType(subscriptionType: string): string | null {
  return STRIPE_PRICE_IDS[subscriptionType as keyof typeof STRIPE_PRICE_IDS] || null;
}

/**
 * Helper to calculate annual savings
 */
export function getAnnualSavings(plan: keyof typeof SUBSCRIPTION_PRICING): number {
  const pricing = SUBSCRIPTION_PRICING[plan];
  if (!pricing.monthly || !pricing.annual) return 0;
  return (pricing.monthly * 12) - pricing.annual;
}

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRICING;
export type OneTimePlan = keyof typeof ONE_TIME_PRICING;
export type GroupPlan = keyof typeof GROUP_PRICING;
