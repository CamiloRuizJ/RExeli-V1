/**
 * POST /api/auth/signup
 * User registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Log environment variable status for debugging
    console.log('[SIGNUP DEBUG] Environment check:', {
      hasEncryptedUrl: !!process.env.ENCRYPTED_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || 'MISSING',
    });

    const body = await request.json();
    const { name, email, password } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with free trial credits
    const FREE_TRIAL_CREDITS = 25; // 5 documents × 5 pages average

    console.log('[SIGNUP DEBUG] Attempting to insert user:', { email: email.toLowerCase(), name });

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'user', // Default role
        credits: FREE_TRIAL_CREDITS,
        subscription_type: 'free',
        subscription_status: 'active',
        is_active: true
      })
      .select('id, name, email, role, credits')
      .single();

    if (createError) {
      console.error('[SIGNUP ERROR] Error creating user:', {
        error: createError,
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code,
      });
      return NextResponse.json(
        {
          error: 'Failed to create account',
          details: createError.message,
          code: createError.code
        },
        { status: 500 }
      );
    }

    // Log the free trial credit transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: newUser.id,
        amount: FREE_TRIAL_CREDITS,
        transaction_type: 'initial_signup',
        description: `Free trial credits on signup (${FREE_TRIAL_CREDITS} credits = ~5 documents)`,
      });

    if (transactionError) {
      console.error('Error logging credit transaction:', transactionError);
      // Note: User is already created, so we log the error but don't fail the request
      // The credit transaction can be manually added later if needed
    }

    console.log(`[NEW USER] ${newUser.email} signed up with ${FREE_TRIAL_CREDITS} free trial credits`);

    return NextResponse.json({
      success: true,
      message: `Account created successfully! You've received ${FREE_TRIAL_CREDITS} free trial credits to get started.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        credits: newUser.credits
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
