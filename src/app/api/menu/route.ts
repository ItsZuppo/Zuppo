import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

const legacyMap: Record<string, string> = {
  "rest-1": "11111111-1111-1111-1111-111111111111",
  "rest-2": "22222222-2222-2222-2222-222222222222",
  "rest-3": "33333333-3333-3333-3333-333333333333",
  "rest-4": "44444444-4444-4444-4444-444444444444",
  "the-royal-kitchen": "11111111-1111-1111-1111-111111111111",
  "burger-hub": "22222222-2222-2222-2222-222222222222",
  "ambikapur-dosa-plaza": "33333333-3333-3333-3333-333333333333",
  "kolkata-kathi-rolls": "44444444-4444-4444-4444-444444444444",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawRestId = searchParams.get("restaurantId");
    const rawItemId = searchParams.get("id");

    let query = supabase
      .from("menu_items")
      .select("*, restaurants(name, area, cuisine)")
      .order("created_at", { ascending: false });

    if (rawItemId) {
      query = query.eq("id", rawItemId);
    }

    if (rawRestId && rawRestId !== "all") {
      const resolvedId = legacyMap[rawRestId] || rawRestId;
      query = query.eq("restaurant_id", resolvedId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: data || [],
      menuItems: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor || !["admin", "partner"].includes(actor.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: actor ? 403 : 401 });
    }

    if (actor.role === "partner" && !actor.restaurantId) return NextResponse.json({ success: false, error: "Kitchen not configured" }, { status: 403 });
    const body = await req.json();

    if (!body.name || !body.price) {
      return NextResponse.json({ success: false, error: "Name and price are required" }, { status: 400 });
    }

    let finalImageUrl = body.imageUrl || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg";
    if (Array.isArray(body.images) && body.images.length > 0) {
      finalImageUrl = body.images.length === 1 ? body.images[0] : JSON.stringify(body.images);
    }

    // Zero-Trust Security: Enforce authenticated session restaurantId if partner is logged in
    const session = await getSessionUser();
    let resolvedRestId =
      legacyMap[body.restaurantId || ""] ||
      body.restaurantId ||
      "11111111-1111-1111-1111-111111111111";

    if (session?.role === "partner" && session.restaurantId) {
      // OVERRIDE: Client cannot inject another restaurant ID!
      resolvedRestId = session.restaurantId;
    }

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: resolvedRestId,
        name: body.name,
        category: body.category || "Main Course",
        price: Number(body.price),
        original_price: body.originalPrice ? Number(body.originalPrice) : null,
        is_veg: body.isVeg ?? true,
        is_bestseller: body.isBestseller ?? false,
        in_stock: true,
        description: body.description || "",
        image_url: finalImageUrl,
      })
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Menu item added successfully!",
      item: data?.[0],
      menuItem: data?.[0],
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

    if (actor.role === "partner" && !actor.restaurantId) return NextResponse.json({ success: false, error: "Kitchen not configured" }, { status: 403 });
    const body = await req.json();
    const itemId = body.itemId || body.id;

    if (!itemId) {
      return NextResponse.json({ success: false, error: "Missing menu item id" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (body.in_stock !== undefined) updates.in_stock = body.in_stock;
    if (body.inStock !== undefined) updates.in_stock = body.inStock;
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.isVeg !== undefined) updates.is_veg = body.isVeg;
    if (body.is_veg !== undefined) updates.is_veg = body.is_veg;
    if (body.isBestseller !== undefined) updates.is_bestseller = body.isBestseller;

    if (Array.isArray(body.images) && body.images.length > 0) {
      updates.image_url = body.images.length === 1 ? body.images[0] : JSON.stringify(body.images);
    } else if (body.imageUrl) {
      updates.image_url = body.imageUrl;
    }

    const session = await getSessionUser();
    let query = supabase
      .from("menu_items")
      .update(updates)
      .eq("id", itemId);

    if (session?.role === "partner" && session.restaurantId) {
      query = query.eq("restaurant_id", session.restaurantId);
    }

    const { data, error } = await query.select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Menu item updated successfully",
      item: data?.[0],
      menuItem: data?.[0],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor || !["admin", "partner"].includes(actor.role)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: actor ? 403 : 401 });
    }

    if (actor.role === "partner" && !actor.restaurantId) return NextResponse.json({ success: false, error: "Kitchen not configured" }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing item id" }, { status: 400 });
    }

    const session = await getSessionUser();
    let query = supabase
      .from("menu_items")
      .delete()
      .eq("id", id);

    if (session?.role === "partner" && session.restaurantId) {
      query = query.eq("restaurant_id", session.restaurantId);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
