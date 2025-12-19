'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, signOut } from '@/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown, LogOut, User } from 'lucide-react';
import MobileMenu from './MobileMenu';

import { Logo } from '@/components/ui/Logo';

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, userProfile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Dynamic navigation based on user role
  const navigationItems = [
    { name: 'Document Tool', href: '/tool', requiresAuth: true },
    // Show appropriate dashboard based on role
    ...(userProfile?.role === 'admin'
      ? [{ name: 'Admin Dashboard', href: '/admin', requiresAuth: true }]
      : user
        ? [{ name: 'My Dashboard', href: '/dashboard', requiresAuth: true }]
        : []
    ),
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const filteredNavItems = navigationItems.filter(
    (item) => !item.requiresAuth || (item.requiresAuth && user)
  );

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <header className="bg-white/90 backdrop-blur-lg border-b border-emerald-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <Logo className="flex-shrink-0" size="sm" />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.href)
                      ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Status Badge - Hidden on mobile */}
              <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-500">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-xs">Operational</span>
              </div>

              {/* Auth Actions - Desktop */}
              <div className="hidden md:flex items-center space-x-3">
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      aria-label="User menu"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''
                          }`}
                      />
                    </button>

                    {userMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
                          <div className="px-4 py-2 border-b border-slate-100">
                            <p className="text-xs text-slate-500">Signed in as</p>
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {user.email}
                            </p>
                          </div>
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md hover:shadow-lg transition-all"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navigationItems={filteredNavItems}
        user={user}
        onSignOut={handleSignOut}
      />
    </>
  );
}
