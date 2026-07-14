import type { NextAuthConfig } from "next-auth";

export type AppRole = "ADMIN" | "COUNSELOR" | "STUDENT";

declare module "next-auth" {
  interface User {
    role: AppRole;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: AppRole;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
  }
}

// The session is valid for 10 minutes and is refreshed (at most once per minute)
// while the user is active, so an idle session expires after ~10 minutes. This
// is enforced server-side via the JWT `exp`; the client-side IdleLogout watcher
// also signs the user out after the same window of no activity.
//
// NOTE: We intentionally do NOT set a custom `cookies` config here. Letting
// Auth.js manage its own cookies (including the automatic `__Secure-` prefix on
// HTTPS) is what makes sign-in work reliably on Vercel.
export const SESSION_MAX_AGE_SECONDS = 10 * 60;

// Session cookies: explicit flags so security posture is not implicit.
//
// Secure cookies (with `__Host-`/`__Secure-` prefixes) require HTTPS — the
// browser silently drops them over plain HTTP, which breaks the CSRF token and
// causes `MissingCSRF` on login. `next start`/standalone always run with
// NODE_ENV=production even when serving http://localhost, so we key the secure
// flag off the actual deployment protocol (AUTH_URL) instead. Real production
// on the VPS uses an https:// AUTH_URL and stays fully secure; a local
// production build served over http://localhost testable without HTTPS.
const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
const secureCookies = authUrl.startsWith("https://")
  || (process.env.NODE_ENV === "production" && !authUrl.startsWith("http://"));

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 60,
  },
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    callbackUrl: {
      name: secureCookies ? "__Secure-authjs.callback-url" : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    csrfToken: {
      name: secureCookies ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
