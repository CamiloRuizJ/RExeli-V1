-- Migration: Add Enterprise Group Subscription Type
-- Description: Adds enterprise_monthly and enterprise_annual to valid group subscription types

-- Drop and recreate the constraint to include enterprise plans
ALTER TABLE user_groups DROP CONSTRAINT IF EXISTS check_group_subscription_type;

ALTER TABLE user_groups ADD CONSTRAINT check_group_subscription_type CHECK (
  subscription_type IN (
    'professional_monthly',
    'professional_annual',
    'business_monthly',
    'business_annual',
    'enterprise_monthly',
    'enterprise_annual'
  )
);
