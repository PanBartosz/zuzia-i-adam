import { redirect } from "next/navigation";
import AdminLogin from "@/components/AdminLogin";
import { getPageSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getPageSession();
  if (session) redirect("/admin");

  return <AdminLogin />;
}
