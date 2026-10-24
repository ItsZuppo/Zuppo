import CustomerHome from "@/components/CustomerHome";
import { getDisplaySession } from "@/lib/auth";
import { readHomepage } from "@/lib/homepageServer";
export const dynamic = "force-dynamic";
export default async function Page() {
 const [user, promotions] = await Promise.all([getDisplaySession(), readHomepage().catch(()=>null)]);
 const initialProfile = user?.role === "customer" ? {name:user.name,phone:user.phone || "",avatarUrl:user.avatarUrl || "",addresses:user.savedAddresses || [],defaultAddressId:user.defaultAddressId || ""} : null;
 return <CustomerHome initialProfile={initialProfile} initialPromotions={promotions}/>;
}
