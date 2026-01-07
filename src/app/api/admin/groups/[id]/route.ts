/**
 * Admin Group Detail API
 * GET - Returns group details with members
 * PATCH - Updates group settings
 * DELETE - Deletes a group (and removes members)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { GROUP_MAX_MEMBERS } from '@/lib/subscriptionManager';
import type { GroupSubscriptionType, GroupDocumentVisibility, GroupSubscriptionStatus } from '@/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Get owner details
    const { data: owner } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', group.owner_id)
      .single();

    // Get group members with user details
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        invited_by,
        is_active
      `)
      .eq('group_id', id)
      .order('role', { ascending: true }) // Owner first
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
    }

    // Get user details for each member
    const memberIds = members?.map(m => m.user_id) || [];
    const { data: memberUsers } = memberIds.length > 0
      ? await supabase
          .from('users')
          .select('id, email, name')
          .in('id', memberIds)
      : { data: [] };

    // Merge member data with user data
    const membersWithDetails = members?.map(member => {
      const user = memberUsers?.find(u => u.id === member.user_id);
      return {
        ...member,
        user_email: user?.email,
        user_name: user?.name,
      };
    }) || [];

    // Get recent credit transactions
    const { data: transactions } = await supabase
      .from('group_credit_transactions')
      .select('*')
      .eq('group_id', id)
      .order('timestamp', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        owner_email: owner?.email,
        owner_name: owner?.name,
        members: membersWithDetails,
        member_count: membersWithDetails.filter(m => m.is_active).length,
      },
      transactions: transactions || [],
    });

  } catch (error) {
    console.error('Admin group GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Check if group exists
    const { data: existingGroup, error: checkError } = await supabase
      .from('user_groups')
      .select('id, name')
      .eq('id', id)
      .single();

    if (checkError || !existingGroup) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add fields
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid group name' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.subscription_type !== undefined) {
      const validSubscriptionTypes: GroupSubscriptionType[] = [
        'professional_monthly',
        'professional_annual',
        'business_monthly',
        'business_annual'
      ];
      if (!validSubscriptionTypes.includes(body.subscription_type)) {
        return NextResponse.json(
          { success: false, error: 'Invalid subscription type' },
          { status: 400 }
        );
      }
      updateData.subscription_type = body.subscription_type;
      // Update max_members based on new subscription type
      updateData.max_members = GROUP_MAX_MEMBERS[body.subscription_type as GroupSubscriptionType];
    }

    if (body.subscription_status !== undefined) {
      const validStatuses: GroupSubscriptionStatus[] = ['active', 'inactive', 'cancelled', 'expired'];
      if (!validStatuses.includes(body.subscription_status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid subscription status' },
          { status: 400 }
        );
      }
      updateData.subscription_status = body.subscription_status;
    }

    if (body.document_visibility !== undefined) {
      const validVisibilities: GroupDocumentVisibility[] = ['shared', 'private'];
      if (!validVisibilities.includes(body.document_visibility)) {
        return NextResponse.json(
          { success: false, error: 'Invalid document visibility' },
          { status: 400 }
        );
      }
      updateData.document_visibility = body.document_visibility;
    }

    if (body.max_members !== undefined) {
      if (typeof body.max_members !== 'number' || body.max_members < 1 || body.max_members > 100) {
        return NextResponse.json(
          { success: false, error: 'Invalid max_members value' },
          { status: 400 }
        );
      }
      updateData.max_members = body.max_members;
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'Invalid is_active value' },
          { status: 400 }
        );
      }
      updateData.is_active = body.is_active;
    }

    if (body.billing_cycle_start !== undefined) {
      updateData.billing_cycle_start = body.billing_cycle_start;
    }

    if (body.billing_cycle_end !== undefined) {
      updateData.billing_cycle_end = body.billing_cycle_end;
    }

    // Update the group
    const { data: updatedGroup, error: updateError } = await supabase
      .from('user_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating group:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update group' },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} updated group "${existingGroup.name}"`);

    return NextResponse.json({
      success: true,
      group: updatedGroup,
      message: 'Group updated successfully',
    });

  } catch (error) {
    console.error('Admin group PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if group exists
    const { data: existingGroup, error: checkError } = await supabase
      .from('user_groups')
      .select('id, name')
      .eq('id', id)
      .single();

    if (checkError || !existingGroup) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Get all members to update their group_id
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', id);

    // Remove group_id from all users
    if (members && members.length > 0) {
      const memberIds = members.map(m => m.user_id);
      await supabase
        .from('users')
        .update({ group_id: null })
        .in('id', memberIds);
    }

    // Delete the group (cascade will delete members and transactions)
    const { error: deleteError } = await supabase
      .from('user_groups')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting group:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete group' },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} deleted group "${existingGroup.name}"`);

    return NextResponse.json({
      success: true,
      message: `Group "${existingGroup.name}" deleted successfully`,
    });

  } catch (error) {
    console.error('Admin group DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
