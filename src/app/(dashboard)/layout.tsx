import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { StudentHeader } from "@/components/layout/student-header";
import { IdleLogout } from "@/components/layout/idle-logout";
import { AuroraBackground } from "@/components/layout/aurora-background";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isStudent = session.user.role === Role.STUDENT;

  if (isStudent) {
    return (
      <SessionProvider session={session} refetchInterval={0} refetchOnWindowFocus>
        <IdleLogout />
        <AuroraBackground />
        <div className="min-h-screen">
          <StudentHeader />
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </div>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider session={session} refetchInterval={0} refetchOnWindowFocus>
      <IdleLogout />
      <AuroraBackground />
      <div className="flex min-h-screen">
        <Sidebar user={session.user} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
