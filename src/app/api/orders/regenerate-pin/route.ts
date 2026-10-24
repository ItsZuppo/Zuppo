import { getSessionUser } from "@/lib/auth";
import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "customer") return NextResponse.json({ success: false, error: "Customer login required" }, { status: user ? 403 : 401 });
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing orderId" }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const col = isUuid ? "id" : "order_number";

    const { data: existing } = await supabase
      .from("orders")
      .select("status, customer_id, delivery_pin")
      .eq(col, orderId)
      .maybeSingle();

    if (!existing || existing.customer_id !== user.id) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    if (existing && ["delivered", "cancelled"].includes(existing.status)) {
      return NextResponse.json({ success: false, error: "Order already closed." }, { status: 409 });
    }

    // Generate fresh random 4-digit PIN
    const newPin = randomInt(1000, 10000).toString();

    const { data: saved, error } = await supabase.from("orders").update({ delivery_pin: newPin })
      .eq(col, orderId).eq("customer_id", user.id).eq("status", existing.status).select("id");
    if (error) return NextResponse.json({ success: false, error: "PIN could not be saved" }, { status: 503 });
    if (!saved?.length) return NextResponse.json({ success: false, error: "Order changed. Please refresh." }, { status: 409 });

    return NextResponse.json({
      success: true,
      newPin,
      message: "Delivery PIN regenerated successfully! Share this new code with the rider.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
