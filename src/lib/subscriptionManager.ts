/**
 * Subscription Manager
 *
 * Handles subscription plan assignments, credit resets, and subscription lifecycle
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Subscription plan credit allocations
 * Based on average 5 pages per document
 */
export const SUBSCRIPTION_CREDITS = {
  free: 0,
  entrepreneur_monthly: 250, // 50 docs × 5 pages
  professional_monthly: 1500, // 300 docs × 5 pages
  business_monthly: 7500, // 1500 docs × 5 pages
  entrepreneur_annual: 250, // Same monthly allocation
  professional_annual: 1500,
  business_annual: 7500,
  one_time_entrepreneur: 250,
  one_time_professional: 1250,
  one_time_business: 6250,
} as const;

export type SubscriptionType = keyof typeof SUBSCRIPTION_CREDITS;

/**
 * Assign subscription plan to user
 * @param userId - User's UUID
 * @param planType - Subscription plan type
 * @param adminId - Admin UUID (if assigned by admin)
 * @returns Success status
 */
export async function assignSubscriptionPlan(
  userId: string,
  planType: string,
  adminId?: string
): Promise<{
  success: boolean;
  message: string;
  credits?: number;
}> {
  try {
    const credits = SUBSCRIPTION_CREDITS[planType as SubscriptionType] || 0;
    const isMonthlyOrAnnual =
      planType.includes('monthly') || planType.includes('annual');
    const isOneTime = planType === 'one_time';

    // Calculate billing cycle dates for recurring subscriptions
    const billingCycleStart = new Date();
    const billingCycleEnd = new Date();

    if (planType.includes('monthly')) {
      billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);
    } else if (planType.includes('annual')) {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    }

    // Update user's subscription
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_type: planType,
        subscription_status: 'active',
        credits: credits,
        monthly_usage: 0, // Reset usage when new plan assigned
        billing_cycle_start: isMonthlyOrAnnual ? billingCycleStart.toISOString() : null,
        billing_cycle_end: isMonthlyOrAnnual ? billingCycleEnd.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Log credit transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: credits,
        transaction_type: adminId ? 'admin_add' : 'purchase',
        description: `Subscription plan assigned: ${planType}`,
        admin_id: adminId,
      });

    if (transactionError) {
      console.error('Error logging credit transaction:', transactionError);
    }

    // Add to subscription history
    const { error: historyError } = await supabase
      .from('subscription_history')
      .insert({
        user_id: userId,
        plan_type: planType,
        status: 'active',
        started_at: new Date().toISOString(),
      });

    if (historyError) {
      console.error('Error logging subscription history:', historyError);
    }

    return {
      success: true,
      message: `Successfully assigned ${planType} plan with ${credits} credits`,
      credits,
    };
  } catch (error) {
    console.error('Error assigning subscription plan:', error);
    return {
      success: false,
      message: 'Failed to assign subscription plan. Please try again.',
    };
  }
}

/**
 * Reset monthly credits for users on billing cycle
 * Should be run daily by cron job
 * @returns Number of users reset
 */
export async function resetMonthlyCredits(): Promise<{
  success: boolean;
  usersReset: number;
  message: string;
}> {
  try {
    // Get users whose billing cycle has ended
    const { data: usersToReset, error: fetchError } = await supabase
      .from('users')
      .select('id, email, subscription_type, billing_cycle_end')
      .eq('subscription_status', 'active')
      .lte('billing_cycle_end', new Date().toISOString())
      .in('subscription_type', [
        'entrepreneur_monthly',
        'professional_monthly',
        'business_monthly',
        'entrepreneur_annual',
        'professional_annual',
        'business_annual',
      ]);

    if (fetchError) {
      throw fetchError;
    }

    if (!usersToReset || usersToReset.length === 0) {
      return {
        success: true,
        usersReset: 0,
        message: 'No users to reset',
      };
    }

    // Reset each user
    let resetCount = 0;
    for (const user of usersToReset) {
      const credits =
        SUBSCRIPTION_CREDITS[user.subscription_type as SubscriptionType] || 0;

      // Calculate new billing cycle
      const newCycleStart = new Date();
      const newCycleEnd = new Date();

      if (user.subscription_type.includes('monthly')) {
        newCycleEnd.setMonth(newCycleEnd.getMonth() + 1);
      } else if (user.subscription_type.includes('annual')) {
        newCycleEnd.setFullYear(newCycleEnd.getFullYear() + 1);
      }

      // Update user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          credits: credits,
          monthly_usage: 0,
          billing_cycle_start: newCycleStart.toISOString(),
          billing_cycle_end: newCycleEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error resetting credits for user ${user.email}:`, updateError);
        continue;
      }

      // Log credit transaction
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: credits,
        transaction_type: 'subscription_reset',
        description: `Monthly credit reset: ${user.subscription_type}`,
      });

      resetCount++;

      // TODO: Send renewal email
      console.log(`[CREDIT RESET] User ${user.email} credits renewed: ${credits}`);
    }

    return {
      success: true,
      usersReset: resetCount,
      message: `Successfully reset credits for ${resetCount} users`,
    };
  } catch (error) {
    console.error('Error resetting monthly credits:', error);
    return {
      success: false,
      usersReset: 0,
      message: 'Failed to reset monthly credits',
    };
  }
}

/**
 * Check and mark expired subscriptions
 * Should be run daily by cron job
 * @returns Number of subscriptions expired
 */
export async function checkSubscriptionExpiry(): Promise<{
  success: boolean;
  subscriptionsExpired: number;
  message: string;
}> {
  try {
    // Get expired subscriptions
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, subscription_type, billing_cycle_end')
      .eq('subscription_status', 'active')
      .lt('billing_cycle_end', new Date().toISOString())
      .eq('subscription_type', 'one_time');

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return {
        success: true,
        subscriptionsExpired: 0,
        message: 'No expired subscriptions',
      };
    }

    // Mark subscriptions as expired
    let expiredCount = 0;
    for (const user of expiredUsers) {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_status: 'expired',
          credits: 0, // Clear remaining credits from one-time purchase
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error expiring subscription for user ${user.email}:`, updateError);
        continue;
      }

      // Update subscription history
      await supabase
        .from('subscription_history')
        .update({
          status: 'expired',
          ended_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('status', 'active');

      expiredCount++;

      // TODO: Send expiration/renewal reminder email
      console.log(`[SUBSCRIPTION EXPIRED] User ${user.email}`);
    }

    return {
      success: true,
      subscriptionsExpired: expiredCount,
      message: `Marked ${expiredCount} subscriptions as expired`,
    };
  } catch (error) {
    console.error('Error checking subscription expiry:', error);
    return {
      success: false,
      subscriptionsExpired: 0,
      message: 'Failed to check subscription expiry',
    };
  }
}

/**
 * Add credits to user account (for admin or purchases)
 * @param userId - User's UUID
 * @param amount - Number of credits to add
 * @param transactionType - Type of transaction
 * @param adminId - Admin UUID (if admin action)
 * @param description - Optional description
 * @returns Success status
 */
export async function addCreditsToUser(
  userId: string,
  amount: number,
  transactionType: 'admin_add' | 'purchase' | 'bonus',
  adminId?: string,
  description?: string
): Promise<{
  success: boolean;
  message: string;
  newBalance?: number;
}> {
  try {
    // Use the database function
    const { data, error } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_admin_id: adminId,
      p_description: description || `Credits added: ${amount}`,
    });

    if (error) {
      throw error;
    }

    // Get new balance
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    return {
      success: true,
      message: `Successfully added ${amount} credits`,
      newBalance: user?.credits || 0,
    };
  } catch (error) {
    console.error('Error adding credits:', error);
    return {
      success: false,
      message: 'Failed to add credits. Please try again.',
    };
  }
}

/**
 * Get subscription plan details
 * @param planType - Subscription type
 * @returns Plan details
 */
export function getSubscriptionDetails(planType: string): {
  name: string;
  credits: number;
  billingCycle: 'monthly' | 'annual' | 'one-time' | 'free';
} {
  const credits = SUBSCRIPTION_CREDITS[planType as SubscriptionType] || 0;

  let name = planType;
  let billingCycle: 'monthly' | 'annual' | 'one-time' | 'free' = 'free';

  if (planType.includes('monthly')) {
    billingCycle = 'monthly';
    name = planType.replace('_monthly', '').replace('_', ' ');
  } else if (planType.includes('annual')) {
    billingCycle = 'annual';
    name = planType.replace('_annual', '').replace('_', ' ');
  } else if (planType.includes('one_time')) {
    billingCycle = 'one-time';
    name = planType.replace('one_time_', '').replace('_', ' ');
  }

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    credits,
    billingCycle,
  };
}

/**
 * Cancel user subscription
 * @param userId - User's UUID
 * @returns Success status
 */
export async function cancelSubscription(userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Update user subscription status
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Update subscription history
    await supabase
      .from('subscription_history')
      .update({
        status: 'cancelled',
        ended_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    return {
      success: true,
      message: 'Subscription cancelled successfully',
    };
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return {
      success: false,
      message: 'Failed to cancel subscription',
    };
  }
}
