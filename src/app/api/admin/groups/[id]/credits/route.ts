/**
 * Admin Group Credits API
 * GET - Returns group credit transactions
 * POST - Adds credits to a group
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { addCreditsToGroup } from '@/lib/subscriptionManager';

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if group exists
    const { data: group, error: groupError } = await supabase
      .from('user_groups')
      .select('id, name, credits')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Group not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from('group_credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', id);

    // Get transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('group_credit_transactions')
      .select('*')
      .eq('group_id', id)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Get user details for transactions that have user_id
    const userIds = transactions
      ?.map(t => t.user_id)
      .filter((id): id is string => id != null) || [];

    const adminIds = transactions
      ?.map(t => t.admin_id)
      .filter((id): id is string => id != null) || [];

    const allUserIds = [...new Set([...userIds, ...adminIds])];

    const { data: users } = allUserIds.length > 0
      ? await supabase
          .from('users')
          .select('id, email, name')
          .in('id', allUserIds)
      : { data: [] };

    // Enrich transactions with user info
    const enrichedTransactions = transactions?.map(t => {
      const user = users?.find(u => u.id === t.user_id);
      const admin = users?.find(u => u.id === t.admin_id);
      return {
        ...t,
        user_email: user?.email,
        user_name: user?.name,
        admin_email: admin?.email,
        admin_name: admin?.name,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      currentBalance: group.credits,
      total: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Admin group credits GET error:', error);
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
    const { amount, description } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credit amount. Must be a positive number.' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { success: false, error: 'Credit amount too large. Maximum is 100,000 credits per transaction.' },
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
        { success: false, error: 'Cannot add credits to an inactive group' },
        { status: 400 }
      );
    }

    // Determine admin ID - only use if it's a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const adminId = uuidRegex.test(session.user.id) ? session.user.id : undefined;

    // Add credits using subscription manager
    const result = await addCreditsToGroup(
      id,
      amount,
      'admin_add',
      adminId,
      description || `${amount} credits manually added by admin (by ${session.user.email})`
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      );
    }

    console.log(`[ADMIN ACTION] Admin ${session.user.email} added ${amount} credits to group "${group.name}"`);

    return NextResponse.json({
      success: true,
      message: result.message,
      newBalance: result.newBalance,
    });

  } catch (error) {
    console.error('Admin group credits POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
