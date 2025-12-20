/**
 * Admin Payments API
 * Returns all payments with stats for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase';

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
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');

    // Check if payments table exists
    const { error: tableCheckError } = await supabaseAdmin
      .from('payments')
      .select('id')
      .limit(1);

    // If table doesn't exist, return empty data
    if (tableCheckError && tableCheckError.code === '42P01') {
      return NextResponse.json({
        payments: [],
        stats: {
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalPayments: 0,
          activeSubscriptions: 0
        }
      });
    }

    // Build query for payments with user info
    let query = supabaseAdmin
      .from('payments')
      .select(`
        id,
        user_id,
        stripe_payment_id,
        amount,
        currency,
        plan_type,
        status,
        payment_method,
        description,
        created_at,
        users!payments_user_id_fkey (
          email,
          name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (plan && plan !== 'all') {
      query = query.eq('plan_type', plan);
    }

    const { data: payments, error: paymentsError } = await query;

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      // Return empty if table or query fails
      return NextResponse.json({
        payments: [],
        stats: {
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalPayments: 0,
          activeSubscriptions: 0
        }
      });
    }

    // Transform data to include user info at top level
    const transformedPayments = (payments || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      user_email: p.users?.email,
      user_name: p.users?.name,
      stripe_payment_id: p.stripe_payment_id,
      amount: p.amount,
      currency: p.currency,
      plan_type: p.plan_type,
      status: p.status,
      payment_method: p.payment_method,
      description: p.description,
      created_at: p.created_at
    }));

    // Calculate stats
    const { data: allPayments } = await supabaseAdmin
      .from('payments')
      .select('amount, status, created_at');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue = (allPayments || [])
      .filter(p => p.status === 'succeeded' || p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const monthlyRevenue = (allPayments || [])
      .filter(p => {
        const createdAt = new Date(p.created_at);
        return (p.status === 'succeeded' || p.status === 'paid') && createdAt >= startOfMonth;
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Get active subscriptions count from users table
    const { data: activeUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('subscription_status', 'active');

    const stats = {
      totalRevenue,
      monthlyRevenue,
      totalPayments: allPayments?.length || 0,
      activeSubscriptions: activeUsers?.length || 0
    };

    return NextResponse.json({
      payments: transformedPayments,
      stats
    });

  } catch (error) {
    console.error('Admin payments API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
