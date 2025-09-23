import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import CryptoJS from "crypto-js"

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

        const user = ADMIN_USERS.find(u => u.email === credentials.email)
        if (!user) {
          return null
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
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
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
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