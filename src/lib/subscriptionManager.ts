/**
 * Subscription Manager
 *
 * Handles subscription plan assignments, credit resets, and subscription lifecycle
 * for both individual users and user groups
 */

import { supabaseAdmin as supabase } from './supabase';
import type { GroupSubscriptionType } from './types';

/**
 * Subscription plan credit allocations (individual users)
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
 * Group subscription plan credit allocations
 * Shared pool for all group members
 * Based on pricing: Professional (300 docs), Business (1,500 docs), Enterprise (10,000+ docs)
 */
export const GROUP_SUBSCRIPTION_CREDITS: Record<GroupSubscriptionType, number> = {
  professional_monthly: 1500,   // 300 docs × 5 pages
  professional_annual: 1500,
  business_monthly: 7500,       // 1,500 docs × 5 pages
  business_annual: 7500,
  enterprise_monthly: 50000,    // 10,000+ docs × 5 pages (negotiated)
  enterprise_annual: 50000,
} as const;

/**
 * Maximum members allowed per group subscription type
 */
export const GROUP_MAX_MEMBERS: Record<GroupSubscriptionType, number> = {
  professional_monthly: 3,
  professional_annual: 3,
  business_monthly: 10,
  business_annual: 10,
  enterprise_monthly: 999,      // Unlimited users (practically)
  enterprise_annual: 999,
} as const;

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
    const isOneTime = planType.includes('one_time');

    console.log('[assignSubscriptionPlan] Assigning plan:', {
      userId,
      planType,
      credits,
      isMonthlyOrAnnual,
      isOneTime,
    });

    // Calculate billing cycle dates for recurring subscriptions
    const billingCycleStart = new Date();
    const billingCycleEnd = new Date();

    if (planType.includes('monthly')) {
      billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);
    } else if (planType.includes('annual')) {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    } else if (isOneTime) {
      // One-time purchases don't expire - set billing cycle end to far future
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 100);
    }

    // Update user's subscription
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_type: planType,
        subscription_status: 'active',
        credits: credits,
        monthly_usage: 0, // Reset usage when new plan assigned
        billing_cycle_start: (isMonthlyOrAnnual || isOneTime) ? billingCycleStart.toISOString() : null,
        billing_cycle_end: (isMonthlyOrAnnual || isOneTime) ? billingCycleEnd.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[assignSubscriptionPlan] Error updating user:', updateError);
      throw updateError;
    }

    console.log('[assignSubscriptionPlan] User updated successfully');

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
    console.log('[addCreditsToUser] Adding credits:', {
      userId,
      amount,
      transactionType,
      adminId,
      description,
    });

    // Use the database function
    const { data, error } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_admin_id: adminId || null,
      p_description: description || `Credits added: ${amount}`,
    });

    if (error) {
      console.error('[addCreditsToUser] RPC error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    console.log('[addCreditsToUser] RPC result:', data);

    // Get new balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('[addCreditsToUser] Error fetching new balance:', userError);
    }

    console.log('[addCreditsToUser] New balance:', user?.credits);

    return {
      success: true,
      message: `Successfully added ${amount} credits`,
      newBalance: user?.credits || 0,
    };
  } catch (error) {
    console.error('[addCreditsToUser] Exception:', error);
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

// =====================================================
// Group Subscription Management
// =====================================================

/**
 * Assign subscription plan to a user group
 * @param groupId - Group's UUID
 * @param planType - Group subscription plan type
 * @param adminId - Admin UUID who assigned the plan
 * @returns Success status
 */
export async function assignGroupSubscriptionPlan(
  groupId: string,
  planType: GroupSubscriptionType,
  adminId?: string
): Promise<{
  success: boolean;
  message: string;
  credits?: number;
}> {
  try {
    const credits = GROUP_SUBSCRIPTION_CREDITS[planType] || 0;
    const maxMembers = GROUP_MAX_MEMBERS[planType] || 3;

    console.log('[assignGroupSubscriptionPlan] Assigning plan:', {
      groupId,
      planType,
      credits,
      maxMembers,
      adminId,
    });

    // Calculate billing cycle dates
    const billingCycleStart = new Date();
    const billingCycleEnd = new Date();

    if (planType.includes('monthly')) {
      billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);
    } else if (planType.includes('annual')) {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    }

    // Update group's subscription
    const { error: updateError } = await supabase
      .from('user_groups')
      .update({
        subscription_type: planType,
        subscription_status: 'active',
        credits: credits,
        monthly_usage: 0, // Reset usage when new plan assigned
        max_members: maxMembers,
        billing_cycle_start: billingCycleStart.toISOString().split('T')[0],
        billing_cycle_end: billingCycleEnd.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (updateError) {
      console.error('[assignGroupSubscriptionPlan] Error updating group:', updateError);
      throw updateError;
    }

    console.log('[assignGroupSubscriptionPlan] Group updated successfully');

    // Log credit transaction
    const { error: transactionError } = await supabase
      .from('group_credit_transactions')
      .insert({
        group_id: groupId,
        amount: credits,
        transaction_type: adminId ? 'admin_add' : 'purchase',
        description: `Group subscription plan assigned: ${planType}`,
        admin_id: adminId,
      });

    if (transactionError) {
      console.error('Error logging group credit transaction:', transactionError);
    }

    return {
      success: true,
      message: `Successfully assigned ${planType} plan with ${credits} credits (max ${maxMembers} members)`,
      credits,
    };
  } catch (error) {
    console.error('Error assigning group subscription plan:', error);
    return {
      success: false,
      message: 'Failed to assign group subscription plan. Please try again.',
    };
  }
}

/**
 * Add credits to a user group (for admin or purchases)
 * @param groupId - Group's UUID
 * @param amount - Number of credits to add
 * @param transactionType - Type of transaction
 * @param adminId - Admin UUID (if admin action)
 * @param description - Optional description
 * @returns Success status
 */
export async function addCreditsToGroup(
  groupId: string,
  amount: number,
  transactionType: 'admin_add' | 'purchase' | 'bonus' | 'subscription_reset',
  adminId?: string,
  description?: string
): Promise<{
  success: boolean;
  message: string;
  newBalance?: number;
}> {
  try {
    console.log('[addCreditsToGroup] Adding credits:', {
      groupId,
      amount,
      transactionType,
      adminId,
      description,
    });

    // Use the database function
    const { data, error } = await supabase.rpc('add_group_credits', {
      p_group_id: groupId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_admin_id: adminId || null,
      p_description: description || `Credits added: ${amount}`,
    });

    if (error) {
      console.error('[addCreditsToGroup] RPC error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    console.log('[addCreditsToGroup] RPC result:', data);

    // Get new balance
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('credits')
      .eq('id', groupId)
      .single();

    if (groupError) {
      console.error('[addCreditsToGroup] Error fetching new balance:', groupError);
    }

    console.log('[addCreditsToGroup] New balance:', group?.credits);

    return {
      success: true,
      message: `Successfully added ${amount} credits to group`,
      newBalance: group?.credits || 0,
    };
  } catch (error) {
    console.error('[addCreditsToGroup] Exception:', error);
    return {
      success: false,
      message: 'Failed to add credits to group. Please try again.',
    };
  }
}

/**
 * Reset monthly credits for groups on billing cycle
 * Should be run daily by cron job
 * @returns Number of groups reset
 */
export async function resetGroupMonthlyCredits(): Promise<{
  success: boolean;
  groupsReset: number;
  message: string;
}> {
  try {
    // Get groups whose billing cycle has ended
    const { data: groupsToReset, error: fetchError } = await supabase
      .from('user_groups')
      .select('id, name, subscription_type, billing_cycle_end')
      .eq('subscription_status', 'active')
      .eq('is_active', true)
      .lte('billing_cycle_end', new Date().toISOString().split('T')[0]);

    if (fetchError) {
      throw fetchError;
    }

    if (!groupsToReset || groupsToReset.length === 0) {
      return {
        success: true,
        groupsReset: 0,
        message: 'No groups to reset',
      };
    }

    // Reset each group
    let resetCount = 0;
    for (const group of groupsToReset) {
      const credits = GROUP_SUBSCRIPTION_CREDITS[group.subscription_type as GroupSubscriptionType] || 0;

      // Calculate new billing cycle
      const newCycleStart = new Date();
      const newCycleEnd = new Date();

      if (group.subscription_type.includes('monthly')) {
        newCycleEnd.setMonth(newCycleEnd.getMonth() + 1);
      } else if (group.subscription_type.includes('annual')) {
        newCycleEnd.setFullYear(newCycleEnd.getFullYear() + 1);
      }

      // Update group
      const { error: updateError } = await supabase
        .from('user_groups')
        .update({
          credits: credits,
          monthly_usage: 0,
          billing_cycle_start: newCycleStart.toISOString().split('T')[0],
          billing_cycle_end: newCycleEnd.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', group.id);

      if (updateError) {
        console.error(`Error resetting credits for group ${group.name}:`, updateError);
        continue;
      }

      // Log credit transaction
      await supabase.from('group_credit_transactions').insert({
        group_id: group.id,
        amount: credits,
        transaction_type: 'subscription_reset',
        description: `Monthly credit reset: ${group.subscription_type}`,
      });

      resetCount++;

      console.log(`[GROUP CREDIT RESET] Group ${group.name} credits renewed: ${credits}`);
    }

    return {
      success: true,
      groupsReset: resetCount,
      message: `Successfully reset credits for ${resetCount} groups`,
    };
  } catch (error) {
    console.error('Error resetting group monthly credits:', error);
    return {
      success: false,
      groupsReset: 0,
      message: 'Failed to reset group monthly credits',
    };
  }
}

/**
 * Get group subscription plan details
 * @param planType - Group subscription type
 * @returns Plan details
 */
export function getGroupSubscriptionDetails(planType: GroupSubscriptionType): {
  name: string;
  credits: number;
  maxMembers: number;
  billingCycle: 'monthly' | 'annual';
} {
  const credits = GROUP_SUBSCRIPTION_CREDITS[planType] || 0;
  const maxMembers = GROUP_MAX_MEMBERS[planType] || 3;

  let name = planType;
  let billingCycle: 'monthly' | 'annual' = 'monthly';

  if (planType.includes('monthly')) {
    billingCycle = 'monthly';
    name = planType.replace('_monthly', '');
  } else if (planType.includes('annual')) {
    billingCycle = 'annual';
    name = planType.replace('_annual', '');
  }

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    credits,
    maxMembers,
    billingCycle,
  };
}

/**
 * Cancel group subscription
 * @param groupId - Group's UUID
 * @returns Success status
 */
export async function cancelGroupSubscription(groupId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Update group subscription status
    const { error: updateError } = await supabase
      .from('user_groups')
      .update({
        subscription_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      message: 'Group subscription cancelled successfully',
    };
  } catch (error) {
    console.error('Error cancelling group subscription:', error);
    return {
      success: false,
      message: 'Failed to cancel group subscription',
    };
  }
}

/**
 * Check if a group can add more members based on subscription limits
 * @param groupId - Group's UUID
 * @returns Whether group can add more members
 */
export async function canGroupAddMembers(groupId: string): Promise<{
  canAdd: boolean;
  currentMembers: number;
  maxMembers: number;
  message: string;
}> {
  try {
    // Get group info
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('subscription_type, max_members')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return {
        canAdd: false,
        currentMembers: 0,
        maxMembers: 0,
        message: 'Group not found',
      };
    }

    // Count current active members
    const { count, error: countError } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (countError) {
      throw countError;
    }

    const currentMembers = count || 0;
    const maxMembers = group.max_members || GROUP_MAX_MEMBERS[group.subscription_type as GroupSubscriptionType] || 3;

    return {
      canAdd: currentMembers < maxMembers,
      currentMembers,
      maxMembers,
      message: currentMembers < maxMembers
        ? `Group can add ${maxMembers - currentMembers} more member(s)`
        : `Group has reached maximum capacity (${maxMembers} members)`,
    };
  } catch (error) {
    console.error('Error checking group member capacity:', error);
    return {
      canAdd: false,
      currentMembers: 0,
      maxMembers: 0,
      message: 'Failed to check group capacity',
    };
  }
}
