import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalSession from "@/components/PortalSession";
export default async function Layout({ children }: { children: React.ReactNode }) {
 const user = await getSessionUser();
 if (!user || !["rider", "admin"].includes(user.role)) redirect("/rider/login");
 return <div data-portal="rider" className="portal-workspace flex h-dvh flex-col overflow-hidden"><div className="shrink-0"><PortalSession label="Rider workspace" name={user.name} /></div><div className="min-h-0 flex-1">{children}</div></div>;
}
