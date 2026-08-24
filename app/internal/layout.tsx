import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { InternalNavbar } from "@/components/internal-navbar";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context;
  try {
    context = await requirePlatformAdmin();
  } catch {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-muted">
      <InternalNavbar email={context.email} />
      {children}
    </div>
  );
}