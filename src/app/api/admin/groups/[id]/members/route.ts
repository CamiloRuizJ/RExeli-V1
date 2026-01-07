/**
 * Admin Group Members API
 * GET - Returns group members
 * POST - Adds a member to the group
 * DELETE - Removes a member from the group
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { canGroupAddMembers } from '@/lib/subscriptionManager';

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

    // Check if group exists
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('id, name')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Get group members
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', id)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch members' },
        { status: 500 }
      );
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

    // Get capacity info
    const capacityInfo = await canGroupAddMembers(id);

    return NextResponse.json({
      success: true,
      members: membersWithDetails,
      capacity: {
        current: capacityInfo.currentMembers,
        max: capacityInfo.maxMembers,
        canAddMore: capacityInfo.canAdd,
      },
    });

  } catch (error) {
    console.error('Admin group members GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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
    const { user_id, role = 'member' } = body;

    // Validate user_id
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['owner', 'member'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be "owner" or "member"' },
        { status: 400 }
      );
    }

    // Check if group exists
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('id, name, is_active')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    if (!group.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot add members to an inactive group' },
        { status: 400 }
      );
    }

    // Check group capacity
    const capacityInfo = await canGroupAddMembers(id);
    if (!capacityInfo.canAdd) {
      return NextResponse.json(
        { success: false, error: capacityInfo.message },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, group_id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 400 }
      );
    }

    // Check if user is already in a group
    if (user.group_id) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of another group' },
        { status: 400 }
      );
    }

    // Add member to group
    const { data: newMember, error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: id,
        user_id: user_id,
        role: role,
        invited_by: session.user.id,
      })
      .select()
      .single();

    if (memberError) {
      console.error('Error adding member:', memberError);
      return NextResponse.json(
        { success: false, error: 'Failed to add member to group' },
        { status: 500 }
      );
    }

    // Update user's group_id
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ group_id: id })
      .eq('id', user_id);

    if (updateUserError) {
      console.error('Error updating user group_id:', updateUserError);
      // Rollback: remove the member
      await supabase.from('group_members').delete().eq('id', newMember.id);
      return NextResponse.json(
        { success: false, error: 'Failed to update user group membership' },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} added ${user.email} to group "${group.name}"`);

    return NextResponse.json({
      success: true,
      member: {
        ...newMember,
        user_email: user.email,
        user_name: user.name,
      },
      message: `${user.email} added to group "${group.name}"`,
    });

  } catch (error) {
    console.error('Admin group members POST error:', error);
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if group exists
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('id, name, owner_id')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Cannot remove the owner
    if (group.owner_id === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the group owner. Transfer ownership first or delete the group.' },
        { status: 400 }
      );
    }

    // Check if user is a member of this group
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', id)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this group' },
        { status: 400 }
      );
    }

    // Get user email for logging
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    // Remove member from group
    const { error: deleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('id', member.id);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to remove member from group' },
        { status: 500 }
      );
    }

    // Update user's group_id to null
    await supabase
      .from('users')
      .update({ group_id: null })
      .eq('id', userId);

    console.log(`[ADMIN ACTION] Admin ${session.user.email} removed ${user?.email || userId} from group "${group.name}"`);

    return NextResponse.json({
      success: true,
      message: `Member removed from group "${group.name}"`,
    });

  } catch (error) {
    console.error('Admin group members DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
