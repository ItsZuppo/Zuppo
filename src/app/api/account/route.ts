import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { authBackend } from "@/lib/authBackend";
import { isServiceable } from "@/lib/delivery";

export interface SavedAddress { id: string; label: string; address: string; lat: number; lng: number; }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
 const actor = await getSessionUser();
 if (!actor || actor.role !== "customer") return json({success:false,error:"Please sign in as a customer."},401);
 const {data,error} = await authBackend().auth.admin.getUserById(actor.id);
 if (error || !data.user) return json({success:false,error:"Could not load your account."},503);
 const m=data.user.user_metadata || {};
 return json({success:true,profile:{name:m.full_name || actor.name,email:data.user.email,phone:m.phone || "",avatarUrl:m.avatar_url || "",addresses:m.saved_addresses || [],defaultAddressId:m.default_address_id || ""}});
}
export async function PATCH(req: Request) {
 const actor = await getSessionUser();
 if (!actor || actor.role !== "customer") return json({success:false,error:"Please sign in as a customer."},401);
 try {
  const body=await req.json();const client=authBackend();
  const {data,error}=await client.auth.admin.getUserById(actor.id);
  if(error || !data.user) return json({success:false,error:"Account unavailable."},503);
  const metadata=data.user.user_metadata || {};
  let addresses: SavedAddress[]=Array.isArray(metadata.saved_addresses)?metadata.saved_addresses:[];
  const changes: Record<string,unknown>={};
  if(body.action === "profile") {
   if(typeof body.name!=="string" || !body.name.trim() || body.name.trim().length>80) return json({success:false,error:"Enter a name up to 80 characters."},400);
   if(typeof body.phone!=="string" || (body.phone && !/^\+?[\d\s()-]{7,20}$/.test(body.phone))) return json({success:false,error:"Enter a valid phone number."},400);
   changes.full_name=body.name.trim();changes.phone=body.phone.trim();
   if(body.avatarUrl!==undefined) {
    const base=(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev").replace(/\/$/,"");
    if(typeof body.avatarUrl!=="string" || (body.avatarUrl && !body.avatarUrl.startsWith(`${base}/avatars/${actor.id}/`))) return json({success:false,error:"Upload your profile photo first."},400);
    changes.avatar_url=body.avatarUrl;
   }
  } else if(body.action === "add-address") {
   if(addresses.length>=10) return json({success:false,error:"You can save up to 10 addresses."},400);
   if(typeof body.address!=="string" || body.address.trim().length<8 || body.address.length>500 || typeof body.label!=="string" || !body.label.trim() || body.label.length>30 || !isServiceable(body.lat,body.lng)) return json({success:false,error:"Enter a full address and a GPS pin inside our Ambikapur delivery area."},400);
   const address={id:randomUUID(),label:body.label.trim(),address:body.address.trim(),lat:body.lat,lng:body.lng};
   addresses=[...addresses,address];changes.saved_addresses=addresses;
   if(!metadata.default_address_id || body.makeDefault) changes.default_address_id=address.id;
  } else if(body.action === "remove-address") {
   if(!addresses.some(a=>a.id===body.id)) return json({success:false,error:"Address not found."},404);
   addresses=addresses.filter(a=>a.id!==body.id);changes.saved_addresses=addresses;
   if(metadata.default_address_id===body.id) changes.default_address_id=addresses[0]?.id || "";
  } else if(body.action === "default-address") {
   if(!addresses.some(a=>a.id===body.id)) return json({success:false,error:"Address not found."},404);
   changes.default_address_id=body.id;
  } else return json({success:false,error:"Unsupported account action."},400);
  const result=await client.auth.admin.updateUserById(actor.id,{user_metadata:changes});
  if(result.error) return json({success:false,error:"Changes could not be saved. Please retry."},503);
  return json({success:true});
 } catch {return json({success:false,error:"Could not update your account."},400);}
}
