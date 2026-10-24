import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalSession from "@/components/PortalSession";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const user = await getSessionUser();
 if (!user || !["partner", "admin"].includes(user.role)) redirect("/partner/login");
 return <div data-portal="partner" className="portal-workspace"><PortalSession label="Partner workspace" name={user.name} />{children}</div>;
}
