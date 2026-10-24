import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth";
import { sendEmailViaBrevo } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wkxqknaznpzvrylsnorl.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);


function canNotify(email: string | undefined): email is string {
 return typeof email === "string" && !/\.(invalid|test)$/i.test(email);
}

async function listAllUsers() {
 const users=[];
 for(let page=1;;page++){
  const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
  if(error)throw error;
  users.push(...data.users);
  if(data.users.length<1000)return users;
 }
}

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
    if(kErr)throw kErr;
    const allUsers = await listAllUsers();

    const pendingKitchens = (kitchens || []).map((k) => {
      // Find matching owner user metadata for KYC docs
      const ownerUser = allUsers.find(
        (u) => u.app_metadata?.restaurantId === k.id || u.id === k.owner_id
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
      .filter((u) => u.app_metadata?.role === "rider")
      .map((u) => {
        const meta = u.user_metadata || {};
        const kyc = meta.kyc || {};
        return {
          id: u.id,
          name: meta.full_name || "Rider",
          email: u.email,
          phone: meta.phone || "+91 98261 00000",
          vehicle: meta.vehicle || "Hero Splendor (CG 15)",
          status: u.app_metadata?.status || "pending_verification",
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
      const {data:kitchen,error:readError}=await supabase.from("restaurants").select("id,is_blocked,is_open").eq("id",id).maybeSingle();
      if(readError)throw readError;
      if(!kitchen)return NextResponse.json({success:false,error:"Restaurant not found."},{status:404});
      const ownerUser=(await listAllUsers()).find(u=>u.app_metadata?.role==="partner" && u.app_metadata?.restaurantId===id);
      if(!ownerUser)return NextResponse.json({success:false,error:"No partner account is linked to this restaurant."},{status:404});
      if (action === "approve") {
        // Unblock restaurant
        const { error } = await supabase
          .from("restaurants")
          .update({ is_blocked: false, is_open: true })
          .eq("id", id);

        if (error) throw error;

        // Activate the linked, server-managed partner identity.
        if (ownerUser) {
          const {error:activationError}=await supabase.auth.admin.updateUserById(ownerUser.id, {
            app_metadata: { ...ownerUser.app_metadata, role: "partner", restaurantId: id, status: "active" },
            user_metadata: { ...ownerUser.user_metadata, status: "active" },
          });
          if(activationError){
            const rollback=await supabase.from("restaurants").update({is_blocked:kitchen.is_blocked,is_open:kitchen.is_open}).eq("id",id);
            if(rollback.error)console.error("Partner approval rollback failed",rollback.error.code);
            throw activationError;
          }


          // Send approval confirmation email via Brevo
          if (canNotify(ownerUser.email)) {
            await sendEmailViaBrevo({
              toEmail: ownerUser.email,
              toName: ownerUser.user_metadata?.full_name || "Partner",
              subject: "🎉 Kitchen Approved! Your Restaurant is Now LIVE on Zuppo",
              htmlContent: `
                <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                  <h2 style="color: #ea580c;">Congratulations! Your Kitchen is Approved!</h2>
                  <p>Our Ambikapur Admin team has verified your KYC documents. Your restaurant is now officially <strong>LIVE</strong> on Zuppo.</p>
                  <p>You can now log in at <a href="https://zuppo-seven.vercel.app/partner/login">zuppo-seven.vercel.app/partner/login</a> to receive orders, manage your live menu, and add dishes.</p>
                  <br/>
                  <p>Cheers,<br/><strong>Zuppo Ambikapur Operations Team</strong></p>
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
        const {error:rejectKitchenError}=await supabase
          .from("restaurants")
          .update({ is_blocked: true, is_open: false })
          .eq("id", id);
        if(rejectKitchenError)throw rejectKitchenError;
        const {error:rejectOwnerError}=await supabase.auth.admin.updateUserById(ownerUser.id,{
          app_metadata:{...ownerUser.app_metadata,status:"rejected"},
          user_metadata:{...ownerUser.user_metadata,status:"rejected"},
        });
        if(rejectOwnerError)throw rejectOwnerError;

        return NextResponse.json({
          success: true,
          message: `Application rejected: ${rejectReason || "Documents need re-upload"}`,
        });
      }
    }

    if (type === "rider") {
      if (action === "approve") {
        const { data: user,error:readError } = await supabase.auth.admin.getUserById(id);
        if(readError && readError.status!==404)throw readError;
        if(!user?.user || user.user.app_metadata?.role!=="rider")return NextResponse.json({success:false,error:"Rider not found."},{status:404});
        if (user.user) {
          const {error:activationError}=await supabase.auth.admin.updateUserById(id, {
            app_metadata: { ...user.user.app_metadata, role: "rider", status: "active" },
            user_metadata: { ...user.user.user_metadata, status: "active" },
          });
          if(activationError)throw activationError;

          if (canNotify(user.user.email)) {
            await sendEmailViaBrevo({
              toEmail: user.user.email,
              toName: user.user.user_metadata?.full_name || "Rider",
              subject: "🛵 Rider Fleet Approved! Welcome to Zuppo Ambikapur",
              htmlContent: `
                <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
                  <h2 style="color: #ea580c;">Welcome to the Zuppo Delivery Fleet!</h2>
                  <p>Your Driving License and Aadhaar KYC have been verified by Ambikapur Admin.</p>
                  <p>You can now log in at <a href="https://zuppo-seven.vercel.app/rider/login">zuppo-seven.vercel.app/rider/login</a>, toggle <strong>Online</strong>, and start earning ₹40/trip!</p>
                  <br/>
                  <p>Safe riding,<br/><strong>Zuppo Fleet Operations</strong></p>
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
        if(readError && readError.status!==404)throw readError;
        if(!rejected.user || rejected.user.app_metadata?.role!=="rider")return NextResponse.json({success:false,error:"Rider not found."},{status:404});
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
