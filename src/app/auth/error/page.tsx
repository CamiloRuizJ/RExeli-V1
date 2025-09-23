'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'OAuthSignin':
        return 'Error occurred during OAuth sign-in. Please try again.';
      case 'OAuthCallback':
        return 'Error occurred during OAuth callback. Please try again.';
      case 'OAuthCreateAccount':
        return 'Could not create OAuth account. Please try again.';
      case 'EmailCreateAccount':
        return 'Could not create account with email. Please try again.';
      case 'Callback':
        return 'Error occurred during callback. Please try again.';
      case 'OAuthAccountNotLinked':
        return 'Email already exists with different provider. Please sign in with the original provider.';
      case 'EmailSignin':
        return 'Error sending email. Please check your email address.';
      case 'CredentialsSignup':
        return 'Error creating account. Please try again.';
      case 'SessionRequired':
        return 'Authentication required. Please sign in to continue.';
      default:
        return 'An authentication error occurred. Please try signing in again.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-gray-500">
            {getErrorMessage(error)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  What you can do:
                </h3>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                  <li>Check your email and password are correct</li>
                  <li>Ensure you're using the right authentication method</li>
                  <li>Try refreshing the page and signing in again</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <Link href="/auth/signin">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                Try Again
              </Button>
            </Link>

            <Link href="/">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && error && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>Debug Info:</strong> {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}