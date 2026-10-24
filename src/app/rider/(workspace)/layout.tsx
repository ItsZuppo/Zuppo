import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalSession from "@/components/PortalSession";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const user = await getSessionUser();
 if (!user || !["rider", "admin"].includes(user.role)) redirect("/rider/login");
 return <div data-portal="rider" className="portal-workspace"><PortalSession label="Rider workspace" name={user.name} />{children}</div>;
}
