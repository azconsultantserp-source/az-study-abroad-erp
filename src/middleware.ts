import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { canAccessRoute } from "@/lib/rbac-edge";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const publicPaths = ["/login", "/api/auth", "/api/health"];

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.auth;
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  if (pathname === "/") {
    if (role === "STUDENT") {
      return NextResponse.redirect(new URL("/my-portal", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (role === "STUDENT" && !pathname.startsWith("/my-portal") && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/my-portal", request.url));
  }

  if (
    role === "STUDENT" &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/my-portal") &&
    !pathname.startsWith("/api/documents") &&
    !pathname.startsWith("/api/auth")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canAccessRoute(role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
