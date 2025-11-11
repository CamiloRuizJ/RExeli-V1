/**
 * Credit Check Middleware
 *
 * Handles credit validation, deduction, and usage logging
 * Credit Model: 1 credit = 1 page
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Check if user has sufficient credits for processing
 * @param userId - User's UUID
 * @param requiredPages - Number of pages (credits) needed
 * @returns Object with hasCredits boolean and current credit balance
 */
export async function checkUserCredits(
  userId: string,
  requiredPages: number
): Promise<{
  hasCredits: boolean;
  currentCredits: number;
  shortage?: number;
}> {
  try {
    // Get user's current credit balance
    const { data: user, error } = await supabase
      .from('users')
      .select('credits, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is inactive. Please contact support.');
    }

    const currentCredits = user.credits || 0;
    const hasCredits = currentCredits >= requiredPages;

    return {
      hasCredits,
      currentCredits,
      shortage: hasCredits ? undefined : requiredPages - currentCredits,
    };
  } catch (error) {
    console.error('Error checking user credits:', error);
    throw error;
  }
}

/**
 * Deduct credits from user account
 * @param userId - User's UUID
 * @param pageCount - Number of pages (credits) to deduct
 * @returns Success status and remaining credits
 */
export async function deductCredits(
  userId: string,
  pageCount: number
): Promise<{
  success: boolean;
  remainingCredits: number;
  error?: string;
}> {
  try {
    // Call the database function for atomic credit deduction
    const { data, error } = await supabase.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_page_count: pageCount,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      // Insufficient credits
      const { data: user } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      return {
        success: false,
        remainingCredits: user?.credits || 0,
        error: 'Insufficient credits',
      };
    }

    // Get updated credit balance
    const { data: updatedUser } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    return {
      success: true,
      remainingCredits: updatedUser?.credits || 0,
    };
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
    const { error } = await supabase.from('usage_logs').insert({
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
    });

    if (error) {
      console.error('Error logging usage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error logging usage:', error);
    return false;
  }
}

/**
 * Save processed document to user's history
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
    const { data, error } = await supabase
      .from('user_documents')
      .insert({
        user_id: userId,
        file_path: documentData.filePath,
        file_name: documentData.fileName,
        document_type: documentData.documentType,
        extracted_data: documentData.extractedData,
        page_count: documentData.pageCount,
        credits_used: documentData.pageCount,
        processing_status: documentData.processingStatus,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving user document:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error saving user document:', error);
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
 * @param currentCredits - User's current credit balance
 * @param subscription - User's subscription type
 * @returns True if warning should be sent
 */
export function shouldSendLowCreditsWarning(
  currentCredits: number,
  subscription: string
): boolean {
  // Define thresholds based on subscription
  const thresholds: Record<string, number> = {
    entrepreneur_monthly: 25, // 10% of 250
    professional_monthly: 150, // 10% of 1500
    business_monthly: 750, // 10% of 7500
    entrepreneur_annual: 25,
    professional_annual: 150,
    business_annual: 750,
    one_time: 5, // 10% of average 50
    free: 2, // 10% of 25 free credits
  };

  const threshold = thresholds[subscription] || 5;
  return currentCredits <= threshold && currentCredits > 0;
}

/**
 * Get user's credit information
 * @param userId - User's UUID
 * @returns Credit and subscription information
 */
export async function getUserCreditInfo(userId: string): Promise<{
  credits: number;
  subscriptionType: string;
  subscriptionStatus: string;
  monthlyUsage: number;
  lifetimeUsage: number;
  billingCycleEnd: string | null;
} | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(
        'credits, subscription_type, subscription_status, monthly_usage, lifetime_usage, billing_cycle_end'
      )
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    return {
      credits: user.credits || 0,
      subscriptionType: user.subscription_type || 'free',
      subscriptionStatus: user.subscription_status || 'inactive',
      monthlyUsage: user.monthly_usage || 0,
      lifetimeUsage: user.lifetime_usage || 0,
      billingCycleEnd: user.billing_cycle_end,
    };
  } catch (error) {
    console.error('Error getting user credit info:', error);
    return null;
  }
}

/**
 * Validate credit transaction before processing
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
}> {
  try {
    const creditCheck = await checkUserCredits(userId, pageCount);

    if (!creditCheck.hasCredits) {
      return {
        isValid: false,
        message: `Insufficient credits. This document has ${pageCount} ${
          pageCount === 1 ? 'page' : 'pages'
        } but you only have ${creditCheck.currentCredits} ${
          creditCheck.currentCredits === 1 ? 'credit' : 'credits'
        } remaining. Please upgrade your plan to continue.`,
        currentCredits: creditCheck.currentCredits,
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

    return {
      isValid: true,
      message: `This document has ${pageCount} ${
        pageCount === 1 ? 'page' : 'pages'
      } and will use ${pageCount} ${
        pageCount === 1 ? 'credit' : 'credits'
      }. You have ${creditCheck.currentCredits} credits remaining.`,
      currentCredits: creditCheck.currentCredits,
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
