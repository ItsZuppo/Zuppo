import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { authBackend } from "@/lib/authBackend";
export async function POST(req: Request) {
 const user=await getSessionUser();
 if(!user || user.role!=="customer") return NextResponse.json({success:false,error:"Please sign in."},{status:401});
 try {
  const {orderId}=await req.json();
  if(typeof orderId!=="string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({success:false,error:"Invalid order."},{status:400});
  const db=authBackend();
  const {data:order,error}=await db.from("orders").select("restaurant_id, order_items(menu_item_id, quantity)").eq("id",orderId).eq("customer_id",user.id).maybeSingle();
  if(error) throw error;
  if(!order) return NextResponse.json({success:false,error:"Order not found."},{status:404});
  const {data:restaurant,error:restError}=await db.from("restaurants").select("is_open,is_blocked").eq("id",order.restaurant_id).single();
  if(restError) throw restError;
  if(!restaurant.is_open || restaurant.is_blocked) return NextResponse.json({success:false,error:"This restaurant is not accepting orders right now."},{status:409});
  const ids=order.order_items.map(i=>i.menu_item_id).filter(Boolean);
  if(!ids.length) return NextResponse.json({success:false,error:"These older items are no longer linked to the menu. Please browse the restaurant."},{status:409});
  const {data:menu,error:menuError}=await db.from("menu_items").select("id,in_stock,price").in("id",ids).eq("restaurant_id",order.restaurant_id);
  if(menuError) throw menuError;
  const cart: Record<string,number>={};
  for(const item of order.order_items) if(menu?.some(m=>m.id===item.menu_item_id && m.in_stock)) cart[item.menu_item_id]=(cart[item.menu_item_id] || 0)+Math.min(20,Math.max(1,item.quantity));
  if(!Object.keys(cart).length) return NextResponse.json({success:false,error:"The items from this order are currently unavailable."},{status:409});
  return NextResponse.json({success:true,cart,partial:Object.keys(cart).length<order.order_items.length},{headers:{"Cache-Control":"private, no-store"}});
 } catch {return NextResponse.json({success:false,error:"Could not prepare your reorder. Please try again."},{status:503});}
}
