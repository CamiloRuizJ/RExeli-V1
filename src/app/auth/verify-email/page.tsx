/**
 * Email Verification Page
 * Shown after user signs up - asks them to check email
 */

'use client'

import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { resendVerificationEmail } from '@/hooks/useAuth'
import { toast } from 'sonner'

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false)
  const [email, setEmail] = useState('')

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Please enter your email address')
      return
    }

    setIsResending(true)
    try {
      const { error } = await resendVerificationEmail(email)
      if (error) {
        toast.error(error.message || 'Failed to resend verification email')
      } else {
        toast.success('Verification email sent! Check your inbox.')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Check Your Email
          </h1>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            We've sent you a verification email. Please click the link in the
            email to verify your account and get started with RExeli.
          </p>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Didn't receive an email?</strong>
              <br />
              Check your spam folder or request a new verification email below.
            </p>
          </div>

          {/* Resend Email Section */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isResending ? 'Sending...' : 'Resend'}
              </Button>
            </div>
          </div>

          {/* Back to Sign In */}
          <Link href="/auth/signin">
            <Button
              variant="outline"
              className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50"
            >
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
