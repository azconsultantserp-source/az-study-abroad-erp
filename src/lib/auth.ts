import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { rateLimit } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Brute-force protection — production only. Login throttling is skipped
        // outside production so local dev and repeated E2E runs (which log in
        // many times) are never locked out. Set LOGIN_RATE_LIMIT to force a
        // specific limit in any environment (e.g. to test throttling itself).
        const explicitLimit = Number(process.env.LOGIN_RATE_LIMIT);
        const enforceRateLimit =
          explicitLimit > 0 || process.env.NODE_ENV === "production";
        if (enforceRateLimit) {
          const loginAttemptLimit = explicitLimit > 0 ? explicitLimit : 8;
          const loginLimit = rateLimit(`login:${email}`, loginAttemptLimit, 15 * 60_000);
          if (!loginLimit.ok) {
            return null;
          }
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "ADMIN" | "COUNSELOR" | "STUDENT",
        };
      },
    }),
  ],
});
