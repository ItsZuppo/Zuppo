import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalSession from "@/components/PortalSession";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const user = await getSessionUser();
 if (!user || !["admin", "admin"].includes(user.role)) redirect("/admin/login");
 return <div data-portal="admin" className="portal-workspace"><PortalSession label="Admin workspace" name={user.name} />{children}</div>;
}
