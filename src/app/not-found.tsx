import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="az-app-bg flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-az-teal/10 text-az-teal ring-1 ring-az-teal/15">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="text-6xl font-extrabold tracking-tight text-heading">404</p>
      <p className="mt-3 max-w-sm text-content-muted">
        We couldn&apos;t find the page you were looking for. It may have been moved or no longer exists.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-az-teal to-az-teal-light px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-az-teal/25 transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-az-teal/30"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
