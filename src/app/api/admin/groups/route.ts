/**
 * Admin Groups API
 * GET - Returns all groups with stats for admin dashboard
 * POST - Creates a new user group
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { GROUP_SUBSCRIPTION_CREDITS, GROUP_MAX_MEMBERS } from '@/lib/subscriptionManager';
import type { GroupSubscriptionType, GroupDocumentVisibility } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const subscriptionType = searchParams.get('subscription_type');

    // Build query for groups using the view
    let query = supabase
      .from('group_summary')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,owner_email.ilike.%${search}%,owner_name.ilike.%${search}%`);
    }

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      } else {
        query = query.eq('subscription_status', status);
      }
    }

    // Apply subscription type filter
    if (subscriptionType && subscriptionType !== 'all') {
      query = query.eq('subscription_type', subscriptionType);
    }

    const { data: groups, error: groupsError } = await query;

    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }

    // Get stats
    const { data: allGroups } = await supabase
      .from('user_groups')
      .select('id, subscription_status, credits, is_active, subscription_type');

    const { count: totalMembers } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const stats = {
      totalGroups: allGroups?.length || 0,
      activeGroups: allGroups?.filter(g => g.is_active && g.subscription_status === 'active').length || 0,
      totalCreditsInGroups: allGroups?.reduce((sum, g) => sum + (g.credits || 0), 0) || 0,
      totalMembers: totalMembers || 0,
      professionalGroups: allGroups?.filter(g => g.subscription_type?.includes('professional')).length || 0,
      businessGroups: allGroups?.filter(g => g.subscription_type?.includes('business')).length || 0,
    };

    return NextResponse.json({
      success: true,
      groups: groups || [],
      stats
    });

  } catch (error) {
    console.error('Admin groups API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require admin role
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      owner_id,
      subscription_type,
      document_visibility = 'shared',
      initial_credits
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Group name is required' },
        { status: 400 }
      );
    }

    if (!owner_id) {
      return NextResponse.json(
        { success: false, error: 'Owner ID is required' },
        { status: 400 }
      );
    }

    if (!subscription_type) {
      return NextResponse.json(
        { success: false, error: 'Subscription type is required' },
        { status: 400 }
      );
    }

    // Validate subscription type
    const validSubscriptionTypes: GroupSubscriptionType[] = [
      'professional_monthly',
      'professional_annual',
      'business_monthly',
      'business_annual',
      'enterprise_monthly',
      'enterprise_annual'
    ];
    if (!validSubscriptionTypes.includes(subscription_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription type' },
        { status: 400 }
      );
    }

    // Validate document visibility
    const validVisibilities: GroupDocumentVisibility[] = ['shared', 'private'];
    if (!validVisibilities.includes(document_visibility)) {
      return NextResponse.json(
        { success: false, error: 'Invalid document visibility' },
        { status: 400 }
      );
    }

    // Check if owner exists
    const { data: ownerUser, error: ownerError } = await supabase
      .from('users')
      .select('id, email, name, group_id')
      .eq('id', owner_id)
      .single();

    if (ownerError || !ownerUser) {
      return NextResponse.json(
        { success: false, error: 'Owner user not found' },
        { status: 400 }
      );
    }

    // Check if owner is already in a group
    if (ownerUser.group_id) {
      return NextResponse.json(
        { success: false, error: 'Owner is already a member of another group' },
        { status: 400 }
      );
    }

    // Calculate credits and max members based on subscription type
    const credits = initial_credits ?? GROUP_SUBSCRIPTION_CREDITS[subscription_type as GroupSubscriptionType];
    const maxMembers = GROUP_MAX_MEMBERS[subscription_type as GroupSubscriptionType];

    // Calculate billing cycle dates
    const billingCycleStart = new Date();
    const billingCycleEnd = new Date();
    if (subscription_type.includes('monthly')) {
      billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);
    } else if (subscription_type.includes('annual')) {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    }

    // Create the group
    const { data: newGroup, error: createError } = await supabase
      .from('user_groups')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id,
        credits,
        subscription_type,
        subscription_status: 'active',
        document_visibility,
        max_members: maxMembers,
        billing_cycle_start: billingCycleStart.toISOString().split('T')[0],
        billing_cycle_end: billingCycleEnd.toISOString().split('T')[0],
        created_by: session.user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating group:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create group' },
        { status: 500 }
      );
    }

    // Add owner as a member with 'owner' role
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: newGroup.id,
        user_id: owner_id,
        role: 'owner',
        invited_by: session.user.id,
      });

    if (memberError) {
      console.error('Error adding owner as member:', memberError);
      // Rollback: delete the group
      await supabase.from('user_groups').delete().eq('id', newGroup.id);
      return NextResponse.json(
        { success: false, error: 'Failed to add owner to group' },
        { status: 500 }
      );
    }

    // Update user's group_id
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ group_id: newGroup.id })
      .eq('id', owner_id);

    if (updateUserError) {
      console.error('Error updating user group_id:', updateUserError);
      // Continue anyway - the group and membership are created
    }

    // Log initial credit transaction
    await supabase.from('group_credit_transactions').insert({
      group_id: newGroup.id,
      amount: credits,
      transaction_type: 'initial_creation',
      description: `Group created with ${subscription_type} plan`,
      admin_id: session.user.id,
    });

    console.log(`[ADMIN ACTION] Admin ${session.user.email} created group "${name}" with owner ${ownerUser.email}`);

    return NextResponse.json({
      success: true,
      group: newGroup,
      message: `Group "${name}" created successfully with ${credits} credits`,
    });

  } catch (error) {
    console.error('Admin groups POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
