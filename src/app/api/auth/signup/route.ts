/**
 * POST /api/auth/signup
 * User registration endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
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
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // Log the free trial credit transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: newUser.id,
        amount: FREE_TRIAL_CREDITS,
        transaction_type: 'initial_signup',
        description: `Free trial credits on signup (${FREE_TRIAL_CREDITS} credits = ~5 documents)`,
      });

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
