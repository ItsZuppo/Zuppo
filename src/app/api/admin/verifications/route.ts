import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";
import { sendEmailViaBrevo } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: session ? 403 : 401 });
    }

    // 1. Fetch pending/registered partners from restaurants table
    const { data: kitchens, error: kErr } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at", { ascending: false });

    // 2. Fetch riders & users from Supabase Auth admin
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const allUsers = usersData?.users || [];

    const pendingKitchens = (kitchens || []).map((k) => {
      // Find matching owner user metadata for KYC docs
      const ownerUser = allUsers.find(
        (u) => u.user_metadata?.restaurantId === k.id || u.id === k.owner_id
      );
      const kyc = ownerUser?.user_metadata?.kyc || {};
      return {
        id: k.id,
        name: k.name,
        area: k.area,
        cuisine: k.cuisine,
        phone: k.phone,
        bannerUrl: k.banner_url,
        isBlocked: k.is_blocked,
        isOpen: k.is_open,
        status: k.is_blocked ? "pending_verification" : "active",
        createdAt: k.created_at,
        ownerEmail: ownerUser?.email || "N/A",
        ownerName: kyc.ownerName || ownerUser?.user_metadata?.full_name || "Partner",
        fssaiNumber: kyc.fssaiNumber || "FSSAI-AMB-2026",
        panNumber: kyc.panNumber || "PAN-ON-FILE",
        aadhaarNumber: kyc.aadhaarNumber || "AADHAAR-ON-FILE",
        panDocUrl: kyc.panDocUrl || null,
        aadhaarDocUrl: kyc.aadhaarDocUrl || null,
      };
    });

    const pendingRiders = allUsers
      .filter((u) => u.user_metadata?.role === "rider")
      .map((u) => {
        const meta = u.user_metadata || {};
        const kyc = meta.kyc || {};
        return {
          id: u.id,
          name: meta.full_name || "Rider",
          email: u.email,
          phone: meta.phone || "+91 98261 00000",
          vehicle: meta.vehicle || "Hero Splendor (CG 15)",
          status: meta.status || "pending_verification",
          createdAt: u.created_at,
          dlNumber: kyc.dlNumber || "DL-AMB-1001",
          aadhaarNumber: kyc.aadhaarNumber || "AADHAAR-ON-FILE",
          dlDocUrl: kyc.dlDocUrl || null,
          aadhaarDocUrl: kyc.aadhaarDocUrl || null,
        };
      });

    return NextResponse.json({
      success: true,
      kitchens: pendingKitchens,
      riders: pendingRiders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session?.role !== "admin") return NextResponse.json({ success: false, error: "Admin access required" }, { status: session ? 403 : 401 });
    const body = await req.json();
    const { action, type, id, rejectReason } = body; // action: 'approve' | 'reject', type: 'partner' | 'rider'

    if (!id || !["approve", "reject"].includes(action) || !["partner", "rider"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters (action, type, id)." },
        { status: 400 }
      );
    }

    if (type === "partner") {
      if (action === "approve") {
        // Unblock restaurant
        const { error } = await supabase
          .from("restaurants")
          .update({ is_blocked: false, is_open: true })
          .eq("id", id);

        if (error) throw error;

        // Find user and notify via Brevo
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const ownerUser = usersData?.users?.find(
          (u) => u.user_metadata?.restaurantId === id
        );

        if (ownerUser) {
          await supabase.auth.admin.updateUserById(ownerUser.id, {
            app_metadata: { ...ownerUser.app_metadata, role: "partner", restaurantId: id, status: "active" },
            user_metadata: { ...ownerUser.user_metadata, status: "active" },
          });

          // Send approval confirmation email via Brevo
          if (ownerUser.email) {
            await sendEmailViaBrevo({
              toEmail: ownerUser.email,
              toName: ownerUser.user_metadata?.full_name || "Partner",
              subject: "🎉 Kitchen Approved! Your Restaurant is Now LIVE on AmbiBites",
              htmlContent: `
                <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                  <h2 style="color: #ea580c;">Congratulations! Your Kitchen is Approved!</h2>
                  <p>Our Ambikapur Admin team has verified your KYC documents. Your restaurant is now officially <strong>LIVE</strong> on AmbiBites.</p>
                  <p>You can now log in at <a href="https://ambibite.vercel.app/partner">ambibite.vercel.app/partner</a> to receive orders, manage your live menu, and add dishes.</p>
                  <br/>
                  <p>Cheers,<br/><strong>AmbiBites Ambikapur Operations Team</strong></p>
                </div>
              `,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: "Restaurant partner KYC approved and kitchen activated!",
        });
      } else {
        // Reject
        await supabase
          .from("restaurants")
          .update({ is_blocked: true, is_open: false })
          .eq("id", id);

        return NextResponse.json({
          success: true,
          message: `Application rejected: ${rejectReason || "Documents need re-upload"}`,
        });
      }
    }

    if (type === "rider") {
      if (action === "approve") {
        const { data: user } = await supabase.auth.admin.getUserById(id);
        if (user?.user) {
          await supabase.auth.admin.updateUserById(id, {
            app_metadata: { ...user.user.app_metadata, role: "rider", status: "active" },
            user_metadata: { ...user.user.user_metadata, status: "active" },
          });

          if (user.user.email) {
            await sendEmailViaBrevo({
              toEmail: user.user.email,
              toName: user.user.user_metadata?.full_name || "Rider",
              subject: "🛵 Rider Fleet Approved! Welcome to AmbiBites Ambikapur",
              htmlContent: `
                <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                  <h2 style="color: #ea580c;">Welcome to the AmbiBites Delivery Fleet!</h2>
                  <p>Your Driving License and Aadhaar KYC have been verified by Ambikapur Admin.</p>
                  <p>You can now log in at <a href="https://ambibite.vercel.app/rider">ambibite.vercel.app/rider</a>, toggle <strong>Online</strong>, and start earning ₹40/trip!</p>
                  <br/>
                  <p>Safe riding,<br/><strong>AmbiBites Fleet Operations</strong></p>
                </div>
              `,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: "Rider approved and activated in fleet!",
        });
      } else {
        const { data: rejected, error: readError } = await supabase.auth.admin.getUserById(id);
        if (readError || !rejected.user) throw new Error("Rider not found");
        const { error: rejectError } = await supabase.auth.admin.updateUserById(id, {
          app_metadata: { ...rejected.user.app_metadata, role: "rider", status: "rejected" },
          user_metadata: { ...rejected.user.user_metadata, status: "rejected" },
        });
        if (rejectError) throw rejectError;
        return NextResponse.json({
          success: true,
          message: `Rider application rejected: ${rejectReason || "Verification failed"}`,
        });
      }
    }

    return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
