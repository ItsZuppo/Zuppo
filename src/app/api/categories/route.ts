import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_CATEGORIES = [
  {
    id: "cat-1",
    name: "Biryani",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
  },
  {
    id: "cat-2",
    name: "Rolls & Wraps",
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "cat-3",
    name: "Burgers",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/double_cheese_burger.jpg",
  },
  {
    id: "cat-4",
    name: "Thali Meals",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/ambikapur_royal_veg_thali.jpg",
  },
  {
    id: "cat-5",
    name: "Pizzas",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/1791717968463_694_image_SM654Q_1764739219.jpg",
  },
  {
    id: "cat-6",
    name: "Chaat & Street",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/crispy_aloo_tikki_chaat.jpg",
  },
  {
    id: "cat-7",
    name: "Dosas",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/mysore_masala_butter_dosa.jpg",
  },
  {
    id: "cat-8",
    name: "Shakes & Chai",
    image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/fresh_mango_kulfi_thickshake.jpg",
  },
];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("address")
      .eq("slug", "system-categories")
      .maybeSingle();

    if (error) {
      console.warn("Categories fetch fallback:", error.message);
      return NextResponse.json({ success: true, categories: DEFAULT_CATEGORIES });
    }

    if (data?.address) {
      try {
        const parsed = JSON.parse(data.address);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ success: true, categories: parsed });
        }
      } catch {}
    }

    return NextResponse.json({ success: true, categories: DEFAULT_CATEGORIES });
  } catch (err: any) {
    return NextResponse.json({ success: true, categories: DEFAULT_CATEGORIES });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "admin") {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: actor ? 403 : 401 });
    }

    const body = await req.json();
    const categories = body.categories;

    if (!Array.isArray(categories)) {
      return NextResponse.json({ success: false, error: "Categories must be an array" }, { status: 400 });
    }

    const payloadString = JSON.stringify(categories);

    // Upsert into restaurants under reserved slug system-categories
    const { data: existing } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", "system-categories")
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("restaurants")
        .update({
          address: payloadString,
          is_blocked: true,
          is_open: false,
        })
        .eq("id", existing.id);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabase
        .from("restaurants")
        .insert({
          name: "SYSTEM_CATEGORIES",
          slug: "system-categories",
          cuisine: "System",
          phone: "+91 00000 00000",
          area: "System",
          address: payloadString,
          is_blocked: true,
          is_open: false,
          commission_percent: 0,
        });

      if (insertErr) {
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, categories });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
