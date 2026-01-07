/**
 * Credit Check Middleware
 *
 * Handles credit validation, deduction, and usage logging
 * Credit Model: 1 credit = 1 page
 *
 * Supports both individual users and group users:
 * - Individual users: credits deducted from users.credits
 * - Group users: credits deducted from user_groups.credits (shared pool)
 */

import { supabaseAdmin as supabase } from '@/lib/supabase';

/**
 * Get user's group information if they belong to a group
 * @param userId - User's UUID
 * @returns Group info or null if not in a group
 */
export async function getUserGroupInfo(userId: string): Promise<{
  groupId: string;
  groupName: string;
  groupCredits: number;
  isOwner: boolean;
} | null> {
  try {
    // Get user's group_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.group_id) {
      return null;
    }

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('id, name, credits, owner_id, is_active')
      .eq('id', user.group_id)
      .single();

    if (groupError || !group || !group.is_active) {
      return null;
    }

    return {
      groupId: group.id,
      groupName: group.name,
      groupCredits: group.credits || 0,
      isOwner: group.owner_id === userId,
    };
  } catch (error) {
    console.error('Error getting user group info:', error);
    return null;
  }
}

/**
 * Check if user has sufficient credits for processing
 * Supports both individual users and group users (shared credit pool)
 *
 * @param userId - User's UUID
 * @param requiredPages - Number of pages (credits) needed
 * @returns Object with hasCredits boolean, current credit balance, and group info
 */
export async function checkUserCredits(
  userId: string,
  requiredPages: number
): Promise<{
  hasCredits: boolean;
  currentCredits: number;
  shortage?: number;
  isGroupMember?: boolean;
  groupId?: string;
  groupName?: string;
}> {
  try {
    // Get user's current info including group membership
    const { data: user, error } = await supabase
      .from('users')
      .select('credits, is_active, group_id')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is inactive. Please contact support.');
    }

    // Check if user is in a group
    if (user.group_id) {
      // Get group credits from the shared pool
      const { data: group, error: groupError } = await supabase
        .from('user_groups')
        .select('id, name, credits, is_active')
        .eq('id', user.group_id)
        .single();

      if (groupError || !group) {
        // Group not found, fall back to individual credits
        console.warn(`Group ${user.group_id} not found for user ${userId}, using individual credits`);
      } else if (!group.is_active) {
        // Group is inactive, fall back to individual credits
        console.warn(`Group ${user.group_id} is inactive for user ${userId}, using individual credits`);
      } else {
        // Use group credits
        const groupCredits = group.credits || 0;
        const hasCredits = groupCredits >= requiredPages;

        return {
          hasCredits,
          currentCredits: groupCredits,
          shortage: hasCredits ? undefined : requiredPages - groupCredits,
          isGroupMember: true,
          groupId: group.id,
          groupName: group.name,
        };
      }
    }

    // Individual user credits
    const currentCredits = user.credits || 0;
    const hasCredits = currentCredits >= requiredPages;

    return {
      hasCredits,
      currentCredits,
      shortage: hasCredits ? undefined : requiredPages - currentCredits,
      isGroupMember: false,
    };
  } catch (error) {
    console.error('Error checking user credits:', error);
    throw error;
  }
}

/**
 * Deduct credits from user account (or group pool if user is in a group)
 * Uses the deduct_effective_credits database function which handles both cases
 *
 * @param userId - User's UUID
 * @param pageCount - Number of pages (credits) to deduct
 * @returns Success status, remaining credits, and group info if applicable
 */
export async function deductCredits(
  userId: string,
  pageCount: number
): Promise<{
  success: boolean;
  remainingCredits: number;
  error?: string;
  isGroupDeduction?: boolean;
  groupId?: string;
}> {
  try {
    // First check if user is in a group
    const { data: user } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', userId)
      .single();

    const isGroupMember = !!user?.group_id;

    // Call the database function that handles both individual and group deduction
    const { data, error } = await supabase.rpc('deduct_effective_credits', {
      p_user_id: userId,
      p_page_count: pageCount,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      // Insufficient credits - get current balance
      if (isGroupMember && user?.group_id) {
        const { data: group } = await supabase
          .from('user_groups')
          .select('credits')
          .eq('id', user.group_id)
          .single();

        return {
          success: false,
          remainingCredits: group?.credits || 0,
          error: 'Insufficient group credits',
          isGroupDeduction: true,
          groupId: user.group_id,
        };
      } else {
        const { data: userData } = await supabase
          .from('users')
          .select('credits')
          .eq('id', userId)
          .single();

        return {
          success: false,
          remainingCredits: userData?.credits || 0,
          error: 'Insufficient credits',
          isGroupDeduction: false,
        };
      }
    }

    // Get updated credit balance
    if (isGroupMember && user?.group_id) {
      const { data: updatedGroup } = await supabase
        .from('user_groups')
        .select('credits')
        .eq('id', user.group_id)
        .single();

      return {
        success: true,
        remainingCredits: updatedGroup?.credits || 0,
        isGroupDeduction: true,
        groupId: user.group_id,
      };
    } else {
      const { data: updatedUser } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      return {
        success: true,
        remainingCredits: updatedUser?.credits || 0,
        isGroupDeduction: false,
      };
    }
  } catch (error) {
    console.error('Error deducting credits:', error);
    return {
      success: false,
      remainingCredits: 0,
      error: 'Failed to deduct credits',
    };
  }
}

/**
 * Log document processing usage
 * @param userId - User's UUID
 * @param documentData - Document processing data
 * @returns Success status
 */
export async function logUsage(
  userId: string,
  documentData: {
    documentType: string;
    fileName: string;
    filePath: string;
    pageCount: number;
    processingStatus: 'success' | 'failed';
    tokensUsed?: number;
    processingTimeMs?: number;
    errorMessage?: string;
  }
): Promise<boolean> {
  try {
    console.log('[logUsage] Attempting to insert usage log for user:', userId, 'document:', documentData.fileName);

    const insertData = {
      user_id: userId,
      document_type: documentData.documentType,
      file_name: documentData.fileName,
      file_path: documentData.filePath,
      page_count: documentData.pageCount,
      credits_used: documentData.pageCount, // 1:1 ratio
      processing_status: documentData.processingStatus,
      tokens_used: documentData.tokensUsed,
      processing_time_ms: documentData.processingTimeMs,
      error_message: documentData.errorMessage,
    };

    console.log('[logUsage] Insert data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase.from('usage_logs').insert(insertData).select();

    if (error) {
      console.error('[logUsage] Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return false;
    }

    console.log('[logUsage] Successfully inserted usage log:', data);
    return true;
  } catch (error) {
    console.error('[logUsage] Exception:', error);
    return false;
  }
}

/**
 * Save processed document to user's history
 * Automatically sets group_id if user is part of a group (for shared document visibility)
 *
 * @param userId - User's UUID
 * @param documentData - Document data
 * @returns Document ID if successful
 */
export async function saveUserDocument(
  userId: string,
  documentData: {
    filePath: string;
    fileName: string;
    documentType: string;
    extractedData: any;
    pageCount: number;
    processingStatus: 'completed' | 'failed';
  }
): Promise<string | null> {
  try {
    console.log('[saveUserDocument] Attempting to save document for user:', userId, 'file:', documentData.fileName);

    // Check if user is in a group
    const { data: user } = await supabase
      .from('users')
      .select('group_id')
      .eq('id', userId)
      .single();

    const insertData: Record<string, any> = {
      user_id: userId,
      file_path: documentData.filePath,
      file_name: documentData.fileName,
      document_type: documentData.documentType,
      extracted_data: documentData.extractedData,
      page_count: documentData.pageCount,
      credits_used: documentData.pageCount,
      processing_status: documentData.processingStatus,
    };

    // Add group_id if user is in a group (for shared document visibility)
    if (user?.group_id) {
      insertData.group_id = user.group_id;
      console.log('[saveUserDocument] User is in group:', user.group_id);
    }

    console.log('[saveUserDocument] Insert data (without extracted_data):', JSON.stringify({
      ...insertData,
      extracted_data: '[REDACTED - too large to log]'
    }, null, 2));

    const { data, error } = await supabase
      .from('user_documents')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[saveUserDocument] Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return null;
    }

    console.log('[saveUserDocument] Successfully saved document with ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('[saveUserDocument] Exception:', error);
    return null;
  }
}

/**
 * Send low credits email notification
 * @param userId - User's UUID
 * @param remainingCredits - Number of credits remaining
 */
export async function sendLowCreditsEmail(
  userId: string,
  remainingCredits: number
): Promise<void> {
  try {
    // Get user email
    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (!user) return;

    // TODO: Implement email service integration
    // For now, just log
    console.log(
      `[LOW CREDITS ALERT] User ${user.email} has ${remainingCredits} credits remaining`
    );

    // In production, integrate with email service (SendGrid, Resend, etc.)
    // await sendEmail({
    //   to: user.email,
    //   subject: 'Running Low on Credits - RExeli',
    //   body: `Hi ${user.name}, you have ${remainingCredits} credits remaining...`
    // });
  } catch (error) {
    console.error('Error sending low credits email:', error);
  }
}

/**
 * Check if user should receive low credits warning
 * Supports both individual and group subscription types
 *
 * @param currentCredits - User's current credit balance (individual or group)
 * @param subscription - User's or group's subscription type
 * @returns True if warning should be sent
 */
export function shouldSendLowCreditsWarning(
  currentCredits: number,
  subscription: string
): boolean {
  // Define thresholds based on subscription (10% of monthly allocation)
  const thresholds: Record<string, number> = {
    // Individual plans
    entrepreneur_monthly: 25, // 10% of 250
    professional_monthly: 150, // 10% of 1500
    business_monthly: 750, // 10% of 7500
    entrepreneur_annual: 25,
    professional_annual: 150,
    business_annual: 750,
    one_time: 5, // 10% of average 50
    free: 2, // 10% of 25 free credits

    // Group plans (same thresholds as individual plans of same tier)
    // Group professional: 1500 credits / month
    // Group business: 7500 credits / month
  };

  const threshold = thresholds[subscription] || 5;
  return currentCredits <= threshold && currentCredits > 0;
}

/**
 * Get user's credit information (returns group info if user is in a group)
 * @param userId - User's UUID
 * @returns Credit and subscription information (individual or group)
 */
export async function getUserCreditInfo(userId: string): Promise<{
  credits: number;
  subscriptionType: string;
  subscriptionStatus: string;
  monthlyUsage: number;
  lifetimeUsage: number;
  billingCycleEnd: string | null;
  // Group-specific fields
  isGroupMember?: boolean;
  groupId?: string;
  groupName?: string;
} | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(
        'credits, subscription_type, subscription_status, monthly_usage, lifetime_usage, billing_cycle_end, group_id'
      )
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    // If user is in a group, return group credit info instead
    if (user.group_id) {
      const { data: group, error: groupError } = await supabase
        .from('user_groups')
        .select(
          'id, name, credits, subscription_type, subscription_status, monthly_usage, lifetime_usage, billing_cycle_end, is_active'
        )
        .eq('id', user.group_id)
        .single();

      if (!groupError && group && group.is_active) {
        return {
          credits: group.credits || 0,
          subscriptionType: group.subscription_type || 'professional_monthly',
          subscriptionStatus: group.subscription_status || 'active',
          monthlyUsage: group.monthly_usage || 0,
          lifetimeUsage: group.lifetime_usage || 0,
          billingCycleEnd: group.billing_cycle_end,
          isGroupMember: true,
          groupId: group.id,
          groupName: group.name,
        };
      }
      // Group not found or inactive, fall through to individual credits
    }

    return {
      credits: user.credits || 0,
      subscriptionType: user.subscription_type || 'free',
      subscriptionStatus: user.subscription_status || 'inactive',
      monthlyUsage: user.monthly_usage || 0,
      lifetimeUsage: user.lifetime_usage || 0,
      billingCycleEnd: user.billing_cycle_end,
      isGroupMember: false,
    };
  } catch (error) {
    console.error('Error getting user credit info:', error);
    return null;
  }
}

/**
 * Validate credit transaction before processing
 * Supports both individual and group credit pools
 *
 * @param userId - User's UUID
 * @param pageCount - Number of pages to process
 * @returns Validation result with user-friendly message
 */
export async function validateCreditTransaction(
  userId: string,
  pageCount: number
): Promise<{
  isValid: boolean;
  message: string;
  currentCredits?: number;
  isGroupMember?: boolean;
  groupName?: string;
}> {
  try {
    const creditCheck = await checkUserCredits(userId, pageCount);

    if (!creditCheck.hasCredits) {
      const creditSource = creditCheck.isGroupMember && creditCheck.groupName
        ? `your group "${creditCheck.groupName}"`
        : 'you';

      return {
        isValid: false,
        message: `Insufficient credits. This document has ${pageCount} ${
          pageCount === 1 ? 'page' : 'pages'
        } but ${creditSource} only ${creditCheck.isGroupMember ? 'has' : 'have'} ${creditCheck.currentCredits} ${
          creditCheck.currentCredits === 1 ? 'credit' : 'credits'
        } remaining. ${creditCheck.isGroupMember ? 'Please contact your group admin to add credits.' : 'Please upgrade your plan to continue.'}`,
        currentCredits: creditCheck.currentCredits,
        isGroupMember: creditCheck.isGroupMember,
        groupName: creditCheck.groupName,
      };
    }

    // Check if we should send low credits warning
    const userInfo = await getUserCreditInfo(userId);
    if (userInfo) {
      const creditsAfterProcessing = creditCheck.currentCredits - pageCount;
      if (
        shouldSendLowCreditsWarning(
          creditsAfterProcessing,
          userInfo.subscriptionType
        )
      ) {
        await sendLowCreditsEmail(userId, creditsAfterProcessing);
      }
    }

    const creditSource = creditCheck.isGroupMember && creditCheck.groupName
      ? `Your group "${creditCheck.groupName}" has`
      : 'You have';

    return {
      isValid: true,
      message: `This document has ${pageCount} ${
        pageCount === 1 ? 'page' : 'pages'
      } and will use ${pageCount} ${
        pageCount === 1 ? 'credit' : 'credits'
      }. ${creditSource} ${creditCheck.currentCredits} credits remaining.`,
      currentCredits: creditCheck.currentCredits,
      isGroupMember: creditCheck.isGroupMember,
      groupName: creditCheck.groupName,
    };
  } catch (error) {
    console.error('Error validating credit transaction:', error);
    return {
      isValid: false,
      message:
        'Unable to validate credits. Please try again or contact support.',
    };
  }
}
