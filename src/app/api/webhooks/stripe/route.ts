/**
 * Stripe Webhook Handler
 *
 * This endpoint receives webhook events from Stripe for:
 * - Successful payments
 * - Subscription changes
 * - Failed payments
 * - Refunds
 *
 * To set up:
 * 1. Create a webhook endpoint in Stripe Dashboard pointing to:
 *    https://your-domain.com/api/webhooks/stripe
 * 2. Select events to listen to:
 *    - checkout.session.completed
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.payment_succeeded
 *    - invoice.payment_failed
 * 3. Copy the webhook signing secret (whsec_xxx) to STRIPE_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isStripeConfigured, getPlanByPriceId, getCreditsForPlan } from '@/lib/stripe';

// Stripe types (uncomment when stripe package is installed)
// import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    console.log('Stripe webhook received but Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // TODO: Verify webhook signature with Stripe
    // const event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   process.env.STRIPE_WEBHOOK_SECRET!
    // );

    // For now, parse the body directly (REMOVE THIS IN PRODUCTION)
    const event = JSON.parse(body);

    console.log('Stripe webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutComplete(session: any) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const customerEmail = session.customer_email;

  console.log('Checkout completed:', { customerId, subscriptionId, customerEmail });

  // Link Stripe customer to user
  if (customerEmail && customerId) {
    await supabaseAdmin
      .from('users')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('email', customerEmail);
  }
}

/**
 * Handle subscription create/update
 */
async function handleSubscriptionUpdate(subscription: any) {
  const customerId = subscription.customer;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id;

  console.log('Subscription updated:', { customerId, status, priceId });

  const planType = priceId ? getPlanByPriceId(priceId) : 'free';
  const credits = planType ? getCreditsForPlan(planType) : 0;

  // Update user subscription status
  await supabaseAdmin
    .from('users')
    .update({
      subscription_status: status === 'active' ? 'active' : 'inactive',
      subscription_type: planType || 'free',
      credits: credits > 0 ? credits : undefined, // Only update if plan has credits
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription: any) {
  const customerId = subscription.customer;

  console.log('Subscription canceled:', { customerId });

  // Update user to free tier
  await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'cancelled',
      subscription_type: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: any) {
  const customerId = invoice.customer;
  const amount = invoice.amount_paid / 100; // Convert from cents
  const currency = invoice.currency;

  console.log('Payment succeeded:', { customerId, amount, currency });

  // Get user by Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, subscription_type')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Record payment
    await supabaseAdmin.from('payments').insert({
      user_id: user.id,
      stripe_payment_id: invoice.payment_intent,
      stripe_customer_id: customerId,
      amount,
      currency,
      plan_type: user.subscription_type || 'unknown',
      status: 'succeeded',
      payment_method: invoice.payment_method_types?.[0] || 'card',
      description: invoice.description || 'Subscription payment',
    });

    // Refresh credits for the billing period
    const credits = getCreditsForPlan(user.subscription_type as any);
    if (credits > 0) {
      await supabaseAdmin
        .from('users')
        .update({
          credits,
          monthly_usage: 0, // Reset monthly usage
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: any) {
  const customerId = invoice.customer;
  const amount = invoice.amount_due / 100;
  const currency = invoice.currency;

  console.log('Payment failed:', { customerId, amount, currency });

  // Get user by Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, subscription_type')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Record failed payment
    await supabaseAdmin.from('payments').insert({
      user_id: user.id,
      stripe_payment_id: invoice.payment_intent,
      stripe_customer_id: customerId,
      amount,
      currency,
      plan_type: user.subscription_type || 'unknown',
      status: 'failed',
      description: 'Payment failed',
    });
  }
}
