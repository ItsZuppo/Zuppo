import { isServiceable } from "@/lib/delivery";
import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .neq("slug", "system-categories")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      restaurants: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "admin") {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: actor ? 403 : 401 });
    }

    const body = await req.json();
    const slug = (body.name || "new-restaurant")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.floor(100 + Math.random() * 900);

    let finalBannerUrl = body.bannerUrl || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/rest-1.jpg";
    if (Array.isArray(body.images) && body.images.length > 0) {
      finalBannerUrl = body.images.length === 1 ? body.images[0] : JSON.stringify(body.images);
    }

    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        name: body.name,
        slug,
        cuisine: body.cuisine || "Multi-Cuisine, Fast Food",
        phone: body.phone || "+91 98261 44551",
        area: body.area || "Ambikapur",
        address: body.address || `${body.area || "Main Road"}, Ambikapur`,
        is_open: true,
        commission_percent: body.commissionPercent || 20.0,
        delivery_time_text: body.deliveryTime || "25-30 min",
        rating: body.rating || 4.5,
        banner_url: finalBannerUrl,
      })
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    revalidateTag("homepage-promotions",{expire:0});
    return NextResponse.json({
      success: true,
      message: "Restaurant added successfully!",
      restaurant: data?.[0],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor || !["admin", "partner"].includes(actor.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: actor ? 403 : 401 });
    }
    const payload = await req.clone().json();
    if (actor.role === "partner" && (payload.id !== actor.restaurantId || payload.is_blocked !== undefined)) {
      return NextResponse.json({ success: false, error: "This restaurant is not yours or requires admin access." }, { status: 403 });
    }

    const body = await req.json();
    const { id, is_open, is_blocked } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing restaurant id" }, { status: 400 });
    }

    if(body.latitude!==undefined || body.longitude!==undefined){
      if(!isServiceable(body.latitude,body.longitude))return NextResponse.json({success:false,error:"Set both pickup coordinates inside the Ambikapur service area."},{status:400});
    }
    const updates: Record<string, any> = {};
    if (is_open !== undefined) updates.is_open = is_open;
    if (is_blocked !== undefined) updates.is_blocked = is_blocked;
    if (body.name !== undefined) updates.name = body.name;
    if (body.cuisine !== undefined) updates.cuisine = body.cuisine;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.area !== undefined) updates.area = body.area;
    if (body.address !== undefined) updates.address = body.address;
    if (body.deliveryTime !== undefined) updates.delivery_time_text = body.deliveryTime;
    if (body.bannerUrl !== undefined) updates.banner_url = body.bannerUrl;
    if(body.latitude!==undefined){updates.latitude=body.latitude;updates.longitude=body.longitude;}

    const { data, error } = await supabase
      .from("restaurants")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    revalidateTag("homepage-promotions",{expire:0});
    return NextResponse.json({
      success: true,
      message: "Restaurant updated successfully",
      restaurant: data?.[0],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
