import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
// TODO: Re-enable OAuth once credentials are configured
// import Google from "next-auth/providers/google"
// import AzureAD from "next-auth/providers/azure-ad"
import bcrypt from "bcryptjs"
import CryptoJS from "crypto-js"
// Note: supabaseAdmin is imported dynamically in authorize() to avoid circular dependency

// Admin user configuration - in production, this should be in a secure database
const ADMIN_USERS = [
  {
    id: "admin-1",
    email: "admin@rexeli.com",
    name: "RExeli Administrator",
    // Password: "RExeli2025!Admin" - securely hashed
    passwordHash: "$2b$12$oG9E4QE/cPmvQS2NldMGV.q3OnoC7LrA5/GxuDkymstGzD6npc46.",
    role: "admin"
  }
]

// Encryption key for API keys - generated securely
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "RExeli-2025-Secure-Key-ForAPI-Encryption-V1-Production"

// Decrypt API keys for runtime use
export function decryptApiKey(encryptedKey: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Failed to decrypt API key:', error)
    throw new Error('Invalid API key configuration')
  }
}

// Encrypt API keys for secure storage
export function encryptApiKey(plainKey: string): string {
  return CryptoJS.AES.encrypt(plainKey, ENCRYPTION_KEY).toString()
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // TODO: Re-enable OAuth providers once credentials are configured
    /*
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
    }),
    */
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Normalize email to lowercase (matches signup behavior)
        const email = (credentials.email as string).toLowerCase()
        const password = credentials.password as string

        // First, try to find user in database
        try {
          // Dynamic import to avoid circular dependency with supabase.ts
          const { supabaseAdmin } = await import("./supabase")

          const { data: dbUser, error } = await supabaseAdmin
            .from('users')
            .select('id, email, password, name, role, credits, subscription_type, subscription_status, is_active')
            .eq('email', email)
            .eq('is_active', true)
            .single()

          if (dbUser && !error) {
            // Verify password
            const isValidPassword = await bcrypt.compare(password, dbUser.password)

            if (isValidPassword) {
              return {
                id: dbUser.id,
                email: dbUser.email,
                name: dbUser.name,
                role: dbUser.role,
                credits: dbUser.credits,
                subscriptionType: dbUser.subscription_type,
                subscriptionStatus: dbUser.subscription_status
              }
            }
          }
        } catch (dbError) {
          console.error('Database authentication error:', dbError)
          // Fall through to admin user check
        }

        // Fall back to admin users
        const adminUser = ADMIN_USERS.find(u => u.email === email)
        if (adminUser) {
          const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash)

          if (isValidPassword) {
            return {
              id: adminUser.id,
              email: adminUser.email,
              name: adminUser.name,
              role: adminUser.role,
              credits: 999999, // Admin has unlimited credits
              subscriptionType: 'admin',
              subscriptionStatus: 'active'
            }
          }
        }

        return null
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.credits = user.credits
        token.subscriptionType = user.subscriptionType
        token.subscriptionStatus = user.subscriptionStatus
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.credits = token.credits as number
        session.user.subscriptionType = token.subscriptionType as string
        session.user.subscriptionStatus = token.subscriptionStatus as string
      }
      return session
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
})