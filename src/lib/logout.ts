import { signOut } from "next-auth/react";

/**
 * Sign the user out and send them to the login page on THIS site.
 *
 * We pass `redirect: false` so Auth.js does not perform its own server-side
 * redirect — that redirect is resolved against the AUTH_URL/NEXTAUTH_URL env
 * var, which (if misconfigured, e.g. left as http://localhost:3000) sends the
 * user to the wrong host and can cause a reload loop after deployment. Doing the
 * navigation ourselves with the current browser origin is always correct.
 */
export async function logoutToLogin(path: string = "/login") {
  try {
    await signOut({ redirect: false });
  } finally {
    window.location.href = `${window.location.origin}${path}`;
  }
}
