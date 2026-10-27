import { randomInt, randomUUID } from "crypto";
import { DELIVERY_FEE, PLATFORM_FEE, isServiceable, validCoords, distanceKm } from "@/lib/delivery";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, AuthUser } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Server client with service role to bypass RLS when permissions allow
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);



// Ambikapur landmark coordinates dictionary
const AMBIKAPUR_COORDS: Record<string, { lat: number; lng: number; distKm: number }> = {
  "Gandhi Chowk": { lat: 23.12341, lng: 83.19330, distKm: 1.2 },
  "Ghadi Chowk": { lat: 23.12295, lng: 83.19799, distKm: 1.8 },
  "Ring Road East": { lat: 23.11801, lng: 83.20313, distKm: 3.2 },
  "Kedarpur": { lat: 23.11559, lng: 83.20455, distKm: 2.5 },
  "Sadhar Hospital Road": { lat: 23.12091, lng: 83.20262, distKm: 1.0 },
  "Mahamaya Temple Road": { lat: 23.13150, lng: 83.18920, distKm: 3.8 },
};

function resolveAmbikapurCoords(areaStr: string) {
  for (const [key, val] of Object.entries(AMBIKAPUR_COORDS)) {
    if (areaStr.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  return null;
}

export interface LiveOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  restaurantName: string;
  restaurantId: string;
  items: { name: string; qty: number; price: number; isVeg?: boolean }[];
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  totalAmount: number;
  paymentMethod: "COD" | "UPI";
  paymentStatus: "pending" | "completed";
  status: "placed" | "preparing" | "ready" | "rider_assigned" | "picked_up" | "delivered" | "cancelled";
  riderName: string | null;
  riderId?: string | null;
  customerId?: string | null;
  createdAt: string;
  prepTimeMinutes: number;
  deliveryPin: string;
  distanceKm: number;
  riderEarnings: number;
  riderLat?: number;
  riderLng?: number;
  riderLocationUpdatedAt?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

// Match an order by UUID id OR by order number without breaking on uuid casts
function matchOrder(q: any, orderId: string) {
  return isUuid(orderId) ? q.eq("id", orderId) : q.eq("order_number", orderId);
}

function randomPin(): string {
  return randomInt(1000, 10000).toString();
}

function toFrontStatus(s: string): LiveOrder["status"] {
  if (s === "ready_for_pickup") return "ready";
  if (["placed", "preparing", "ready", "rider_assigned", "picked_up", "delivered", "cancelled"].includes(s)) {
    return s as LiveOrder["status"];
  }
  return "placed";
}

function rowToOrder(o: any): LiveOrder {
  const items = o.order_items && o.order_items.length > 0
    ? o.order_items.map((oi: any) => ({
        name: oi.name_at_order,
        qty: oi.quantity,
        price: Number(oi.price_at_order),
        isVeg: true,
      }))
    : [{ name: "Selected Food Item", qty: 1, price: Number(o.item_total || 0), isVeg: false }];

  return {
    id: o.id,
    orderNumber: o.order_number || `#ZB-${String(o.id).slice(0, 4)}`,
    customerName: o.customer_name || "Ambikapur Customer",
    customerPhone: o.customer_phone || "",
    deliveryArea: o.delivery_address || "Ambikapur Center",
    restaurantId: o.restaurant_id,
    restaurantName: o.restaurant_name || "The Royal Kitchen",
    items,
    itemTotal: Number(o.item_total || 0),
    deliveryFee: Number(o.delivery_fee || 30),
    platformFee: Number(o.platform_fee || 5),
    totalAmount: Number(o.total_amount || 0),
    paymentMethod: (o.payment_method as "COD" | "UPI") || "COD",
    paymentStatus: (o.payment_status as "pending" | "completed") || "pending",
    status: toFrontStatus(o.status),
    riderName: o.rider_name || null,
    riderId: o.rider_id || null,
    customerId: o.customer_id || null,
    createdAt: o.created_at,
    prepTimeMinutes: 20,
    deliveryPin: o.delivery_pin || "",
    distanceKm: Number(o.distance_km || 2.1),
    riderEarnings: Number(o.rider_earnings || 38),
    // Live GPS is relayed through memory for speed; DB value is the restart-safe fallback
    riderLat: o.rider_lat != null ? Number(o.rider_lat) : undefined,
    riderLng: o.rider_lng != null ? Number(o.rider_lng) : undefined,
    riderLocationUpdatedAt: o.rider_location_updated_at ?? undefined,
    pickupLat: o.restaurants?.latitude != null ? Number(o.restaurants.latitude) : undefined,
    pickupLng: o.restaurants?.longitude != null ? Number(o.restaurants.longitude) : undefined,
    pickupAddress: o.restaurants?.address || undefined,
    deliveryLat: o.delivery_lat != null ? Number(o.delivery_lat) : undefined,
    deliveryLng: o.delivery_lng != null ? Number(o.delivery_lng) : undefined,
  };
}

// ---------------------------------------------------------------------------
// DATA ISOLATION: every role only receives what it is entitled to see.
// Delivery PIN and customer phone are NEVER broadcast to unrelated users.
// ---------------------------------------------------------------------------
function sanitize(o: LiveOrder, keep: { pin?: boolean; phone?: boolean }): any {
  const copy: any = { ...o };
  if (!keep.pin) delete copy.deliveryPin;
  if (!keep.phone) copy.customerPhone = "";
  return copy;
}

function scopeOrders(orders: LiveOrder[], user: AuthUser | null, idParam: string | null): any[] {
  if (!user) return [];
  const selected = idParam ? orders.filter(o => o.id === idParam || o.orderNumber === idParam) : orders;
  return selected.flatMap(o => {
    if (user.role === "admin") return [sanitize(o, { phone: true })];
    if (user.role === "customer" && o.customerId === user.id) return [sanitize(o, { pin: true, phone: true })];
    if (user.role === "partner" && o.restaurantId === user.restaurantId) return [sanitize(o, {})];
    if (user.role === "rider" && (o.riderId === user.id || (!idParam && o.status === "ready" && !o.riderId))) {
      return [sanitize(o, { phone: o.riderId === user.id })];
    }
    return [];
  });
}

async function loadRecord(orderId: string): Promise<LiveOrder | null> {
  // Always prefer DB (source of truth); memory is only for orders that never reached DB
  try {
    const q = matchOrder(supabase.from("orders").select("*, order_items(*), restaurants(latitude,longitude,address)"), orderId);
    const { data } = await q.maybeSingle();
    if (data) {
      return rowToOrder(data);
    }
  } catch (e) {
    console.warn("loadRecord notice:", e);
  }
  return null;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  try {
    let query = supabase.from("orders").select("*, order_items(*), restaurants(latitude,longitude,address)").order("created_at", { ascending: false });
    if (id) query = matchOrder(query, id);
    if (user.role === "customer") query = query.eq("customer_id", user.id);
    if (user.role === "partner") {
      if (!user.restaurantId) return NextResponse.json({ success: false, error: "Kitchen not configured" }, { status: 403 });
      query = query.eq("restaurant_id", user.restaurantId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, source: "supabase", orders: scopeOrders((data || []).map(o => rowToOrder(o)), user, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Orders could not be loaded. Please retry." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "customer") return NextResponse.json({ success: false, error: "Please log in as a customer before checkout." }, { status: user ? 403 : 401 });
    const body = await req.json();
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) return NextResponse.json({ success: false, error: "Cart must contain 1-50 items." }, { status: 400 });
    if (body.paymentMethod !== "COD") return NextResponse.json({ success: false, error: "Online payment is not enabled yet. Please select Cash on Delivery." }, { status: 400 });
    const coords = body.deliveryLat !== undefined || body.deliveryLng !== undefined
      ? { lat: body.deliveryLat, lng: body.deliveryLng }
      : resolveAmbikapurCoords(String(body.deliveryArea || ""));
    if (!coords || !validCoords(coords.lat, coords.lng)) return NextResponse.json({ success: false, error: "Choose a supported Ambikapur area or a valid delivery pin." }, { status: 400 });
    if (!isServiceable(coords.lat, coords.lng)) return NextResponse.json({ success: false, error: "We currently deliver within 12 km of Ambikapur centre only." }, { status: 400 });
    const phone = String(body.customerPhone || user.phone || "").replace(/[\s()+-]/g, "");
    if (!/^(?:91)?[6-9]\d{9}$/.test(phone) || !String(body.customerName || user.name || "").trim()) return NextResponse.json({ success: false, error: "Enter your name and a valid Indian mobile number." }, { status: 400 });
    if (typeof body.addressDetails !== "string" || body.addressDetails.trim().length < 5 || body.addressDetails.length > 300) return NextResponse.json({ success: false, error: "Enter a full delivery address and landmark." }, { status: 400 });
    const ids = body.items.map((i: any) => i.id);
    if (ids.some((id: unknown) => typeof id !== "string" || !isUuid(id)) || body.items.some((i: any) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99)) return NextResponse.json({ success: false, error: "Cart is outdated or quantities are invalid. Please add items from the current menu." }, { status: 400 });
    const { data: menu, error: menuError } = await supabase.from("menu_items").select("*").in("id", ids);
    if (menuError) throw menuError;
    if (new Set(ids).size !== menu?.length || menu.some(i => !i.in_stock)) return NextResponse.json({ success: false, error: "Some items are unavailable. Please update your cart." }, { status: 409 });
    const restaurantId = menu[0].restaurant_id;
    if (menu.some(i => i.restaurant_id !== restaurantId)) return NextResponse.json({ success: false, error: "Please order from one restaurant at a time." }, { status: 400 });
    const { data: restaurant, error: restError } = await supabase.from("restaurants").select("*").eq("id", restaurantId).single();
    if (restError) throw restError;
    if (!restaurant.is_open || restaurant.is_blocked) return NextResponse.json({ success: false, error: "This restaurant is not accepting orders." }, { status: 409 });
    const items = body.items.map((i: any) => {
      const item = menu.find(m => m.id === i.id)!;
      return { menu_item_id: item.id, name_at_order: item.name, price_at_order: Number(item.price), quantity: i.qty, subtotal: Math.round(Number(item.price)*i.qty*100)/100 };
    });
    const itemTotal = Math.round(items.reduce((sum: number, i: any) => sum+i.subtotal, 0)*100)/100;
    const total = Math.round((itemTotal + DELIVERY_FEE + PLATFORM_FEE)*100)/100;
    if (Math.abs(Number(body.totalAmount)-total) > 0.01 || !Number.isFinite(Number(body.totalAmount))) return NextResponse.json({ success: false, error: "Prices have changed. Refresh the menu and check your bill before ordering." }, { status: 409 });
    const restLat = validCoords(Number(restaurant.latitude), Number(restaurant.longitude))
      ? Number(restaurant.latitude)
      : (resolveAmbikapurCoords(String(restaurant.area || restaurant.address || ""))?.lat ?? 23.12);
    const restLng = validCoords(Number(restaurant.latitude), Number(restaurant.longitude))
      ? Number(restaurant.longitude)
      : (resolveAmbikapurCoords(String(restaurant.area || restaurant.address || ""))?.lng ?? 83.1985);
    const km = distanceKm({ lat: restLat, lng: restLng }, coords);
    const row = {
      order_number: `#ZB-${randomUUID()}`, restaurant_id: restaurantId, restaurant_name: restaurant.name,
      customer_id: user.id, customer_name: String(body.customerName || user.name).trim(), customer_phone: phone,
      delivery_address: `${body.addressDetails.trim()}, ${String(body.deliveryArea || "").trim()}`, delivery_lat: coords.lat, delivery_lng: coords.lng,
      item_total: itemTotal, delivery_fee: DELIVERY_FEE, platform_fee: PLATFORM_FEE, total_amount: total,
      payment_method: "COD", payment_status: "pending", status: "placed", delivery_pin: randomPin(),
      distance_km: km, rider_earnings: Math.max(35, 25 + Math.round(Math.max(0, km-1)*7)+5),
    };
    const { data: created, error } = await supabase.from("orders").insert(row).select().single();
    if (error || !created) throw error || new Error("Order not saved");
    const { error: itemError } = await supabase.from("order_items").insert(items.map((i: any) => ({ ...i, order_id: created.id })));
    if (itemError) {
      // Compensating cleanup until checkout is moved to a transactional database function.
      const { error: cleanupError } = await supabase.from("orders").delete().eq("id", created.id);
      if (cleanupError) console.error("Incomplete order requires reconciliation:", created.id);
      throw itemError;
    }
    return NextResponse.json({ success: true, order: rowToOrder({ ...created, order_items: items }) }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Your order could not be saved. Your cart has been kept; please retry." }, { status: 503 });
  }
}

const KITCHEN_STATUSES = ["preparing", "ready", "cancelled"];
const RIDER_STATUSES = ["picked_up", "delivered"];

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { orderId, status, submittedPin, newPin, riderLat, riderLng } = body;
    const accepting = body.action === "accept";
    const correctingPin=body.action==="delivery-pin";

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing orderId" }, { status: 400 });
    }

    // ---- 1. Authentication -------------------------------------------------
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in first." }, { status: 401 });
    }
    const isAdmin = user.role === "admin";
    if (!correctingPin && !accepting && !status && !newPin && riderLat === undefined && riderLng === undefined) return NextResponse.json({ success: false, error: "No update supplied" }, { status: 400 });
    if ((riderLat !== undefined || riderLng !== undefined) && !validCoords(riderLat, riderLng)) return NextResponse.json({ success: false, error: "Invalid GPS coordinates" }, { status: 400 });
    if (newPin && !/^\d{4}$/.test(String(newPin))) return NextResponse.json({ success: false, error: "Invalid delivery PIN" }, { status: 400 });

    const record = await loadRecord(orderId);
    if (!record) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    if(correctingPin){
      if(user.role!=="customer" || record.customerId!==user.id)return NextResponse.json({success:false,error:"Only the order owner can set its delivery pin."},{status:403});
      if(["delivered","cancelled"].includes(record.status))return NextResponse.json({success:false,error:"This delivery is already closed."},{status:409});
      if(!isServiceable(body.deliveryLat,body.deliveryLng) || typeof body.deliveryAddress!=="string" || body.deliveryAddress.trim().length<8 || body.deliveryAddress.length>500)return NextResponse.json({success:false,error:"Provide a complete address and a GPS pin inside our Ambikapur delivery area."},{status:400});
      const {data:saved,error}=await supabase.from("orders").update({delivery_lat:body.deliveryLat,delivery_lng:body.deliveryLng,delivery_address:body.deliveryAddress.trim()}).eq("id",record.id).eq("customer_id",user.id).eq("status",record.status==="ready"?"ready_for_pickup":record.status).select("id");
      if(error)return NextResponse.json({success:false,error:"Delivery pin was not saved. Please retry."},{status:503});
      if(!saved?.length)return NextResponse.json({success:false,error:"Order changed. Refresh before correcting the pin."},{status:409});
      return NextResponse.json({success:true,order:sanitize({...record,deliveryLat:body.deliveryLat,deliveryLng:body.deliveryLng,deliveryArea:body.deliveryAddress.trim()},{pin:true,phone:true})});
    }

    // ---- 2. Authorization (who may do what) ---------------------------------
    if (status) {
      if (KITCHEN_STATUSES.includes(status)) {
        const ownsKitchen =
          user.role === "partner" &&
          user.restaurantId === record.restaurantId;
        if (!isAdmin && !ownsKitchen) {
          return NextResponse.json({ success: false, error: "This order belongs to another kitchen." }, { status: 403 });
        }
        if (!["placed", "preparing", "ready"].includes(record.status)) {
          return NextResponse.json({ success: false, error: `Order already ${record.status}.` }, { status: 409 });
        }
      } else if (RIDER_STATUSES.includes(status)) {
        if (!isAdmin && user.role !== "rider") {
          return NextResponse.json({ success: false, error: "Only riders can do this." }, { status: 403 });
        }
      } else if (status === "rider_assigned") {
        if (!isAdmin) {
          return NextResponse.json({ success: false, error: "Only admin can assign a rider manually." }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
      }
    }

    if ((riderLat !== undefined || riderLng !== undefined) && !isAdmin) {
      if (!(user.role === "rider" && record.riderId === user.id)) {
        return NextResponse.json({ success: false, error: "You can only share GPS for your own delivery." }, { status: 403 });
      }
    }
    if (newPin !== undefined && !isAdmin) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    if ((riderLat !== undefined || riderLng !== undefined) && !["picked_up", "rider_assigned"].includes(record.status)) return NextResponse.json({ success: false, error: "Delivery is not active" }, { status: 409 });

    // Accept reserves the task; pickup is a separate deliberate action.
    if (accepting) {
      if(user.role!=="rider" || status || newPin || riderLat!==undefined || riderLng!==undefined)return NextResponse.json({success:false,error:"Invalid acceptance request."},{status:400});
      if(record.riderId===user.id && ["rider_assigned","picked_up"].includes(record.status))return NextResponse.json({success:true,order:sanitize(record,{phone:true})});
      if(record.status!=="ready" || record.riderId)return NextResponse.json({success:false,error:"This order is no longer available."},{status:409});
      const {data:active,error:activeError}=await supabase.from("orders").select("id,status").eq("rider_id",user.id).in("status",["rider_assigned","picked_up"]);
      if(activeError)return NextResponse.json({success:false,error:"Could not check your active delivery. Please retry."},{status:503});
      if(active?.some(o=>o.id!==record.id && ["rider_assigned","picked_up"].includes(o.status)))return NextResponse.json({success:false,error:"Complete your active delivery before accepting another task."},{status:409});
      const {data:claimed,error:claimErr}=await supabase.from("orders")
        .update({status:"rider_assigned",rider_id:user.id,rider_name:user.name})
        .eq("id",record.id).is("rider_id",null).eq("status","ready_for_pickup").select("id");
      if(claimErr)return NextResponse.json({success:false,error:"Order acceptance was not saved. Refresh to check before retrying."},{status:503});
      if(!claimed?.length)return NextResponse.json({success:false,error:"Another rider accepted this order. Refresh the list."},{status:409});
      return NextResponse.json({success:true,order:sanitize({...record,status:"rider_assigned",riderId:user.id,riderName:user.name},{phone:true})});
    }
    if(status==="picked_up" && !isAdmin){
      if(record.riderId!==user.id)return NextResponse.json({success:false,error:"Accept this task before confirming pickup."},{status:403});
      if(!["rider_assigned","picked_up"].includes(record.status))return NextResponse.json({success:false,error:"This task is not awaiting pickup."},{status:409});
    }

    // ---- 4. Delivery: must be the assigned rider + correct PIN --------------
    if (status === "delivered") {
      if (!isAdmin && record.riderId !== user.id) {
        return NextResponse.json({ success: false, error: "This is not your delivery." }, { status: 403 });
      }
      if (record.status !== "picked_up") {
        return NextResponse.json({ success: false, error: "Confirm pickup before completing delivery." }, { status: 409 });
      }
      // PIN always read from DB (customer may have regenerated it a second ago)
      const expected = String(record.deliveryPin || "").trim();
      const entered = String(submittedPin || "").trim();
      if (!expected || entered !== expected) {
        return NextResponse.json(
          {
            success: false,
            error: expected
              ? "Incorrect Delivery PIN! Customer ki screen pe jo 4-digit PIN dikh raha hai wo maangein."
              : "Delivery PIN not found. Customer se 'Regenerate PIN' dabane ko bolein.",
          },
          { status: 400 }
        );
      }
    }

    // ---- 5. Apply update -----------------------------------------------------
    const adminAssign = isAdmin && status === "rider_assigned";
    if (adminAssign) {
      if (!["ready", "rider_assigned"].includes(record.status) || typeof body.riderId !== "string" || !isUuid(body.riderId)) return NextResponse.json({ success: false, error: "Select an approved rider for a ready order." }, { status: 400 });
      const { data: assigned, error: riderError } = await supabase.auth.admin.getUserById(body.riderId);
      if (riderError || assigned.user?.app_metadata?.role !== "rider" || assigned.user?.app_metadata?.status !== "active") return NextResponse.json({ success: false, error: "Rider is not approved." }, { status: 400 });
      body.riderName = assigned.user.user_metadata?.full_name || "Rider";
    }
    const next: LiveOrder = {
      ...record,
      ...(status ? { status } : {}),
      ...(adminAssign ? { riderName: body.riderName ?? null, riderId: body.riderId ?? null } : {}),
      ...(newPin ? { deliveryPin: String(newPin) } : {}),
      ...(status === "delivered" ? { paymentStatus: "completed" as const } : {}),
      ...(riderLat !== undefined ? { riderLat: Number(riderLat) } : {}),
      ...(riderLng !== undefined ? { riderLng: Number(riderLng) } : {}),
      ...(riderLat !== undefined ? { riderLocationUpdatedAt: new Date().toISOString() } : {}),
    };


    const updatePayload: Record<string, any> = {};
    if (status) updatePayload.status = status === "ready" ? "ready_for_pickup" : status;
    if (status === "delivered") updatePayload.payment_status = "completed";
    if (adminAssign) {
      updatePayload.rider_name = body.riderName ?? null;
      updatePayload.rider_id = body.riderId ?? null;
    }
    if (newPin) updatePayload.delivery_pin = String(newPin);
    if (riderLat !== undefined) updatePayload.rider_lat = Number(riderLat);
    if (riderLng !== undefined) updatePayload.rider_lng = Number(riderLng);
    if (riderLat !== undefined) updatePayload.rider_location_updated_at = new Date().toISOString();

    if (Object.keys(updatePayload).length > 0 && isUuid(record.id)) {
      let update = supabase.from("orders").update(updatePayload).eq("id", record.id).eq("status", record.status === "ready" ? "ready_for_pickup" : record.status);
      if (status === "delivered") update = update.eq("delivery_pin", record.deliveryPin);
      const { data: saved, error: patchErr } = await update.select("id");
      if (!patchErr && !saved?.length) return NextResponse.json({ success: false, error: "Order changed. Refresh and try again." }, { status: 409 });
      if (patchErr) return NextResponse.json({ success: false, error: "Update was not saved. Please retry." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: status === "delivered" ? "PIN Verified! Order marked Delivered." : "Order updated successfully",
      order: sanitize(next, { phone: user.role === "rider" || isAdmin }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update order" },
      { status: 500 }
    );
  }
}
