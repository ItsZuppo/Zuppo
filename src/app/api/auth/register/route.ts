import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authBackend, authError } from "@/lib/authBackend";
import {
  AuthUser,
  signSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const supabase = authBackend();
    const body = await req.json();
    const {
      role = "customer",
      email: rawEmail,
      password,
      name,
      phone,
      // Restaurant KYC fields
      kitchenName,
      cuisine,
      area,
      address,
      fssaiNumber,
      panNumber,
      aadhaarNumber,
      panDocUrl,
      aadhaarDocUrl,
      bannerUrl,
      // Rider KYC fields
      vehicleNumber,
      dlNumber,
      dlDocUrl,
    } = body;

    const email = rawEmail?.trim().toLowerCase();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (!["customer", "partner", "rider"].includes(role)) return NextResponse.json({ success: false, error: "Invalid registration role." }, { status: 400 });
    const proof = (await cookies()).get("zuppo_signup_proof")?.value;
    const { data: verified, error: proofError } = await supabase.auth.getUser(proof || "invalid");
    if (proofError || !verified.user || verified.user.email?.toLowerCase() !== email || !verified.user.email_confirmed_at) return NextResponse.json({ success: false, error: "Please verify your email code again before registering." }, { status: 400 });
    if (verified.user.app_metadata?.role) return NextResponse.json({ success: false, error: "This account is already registered. Please sign in or reset your password." }, { status: 409 });

    // 1. CUSTOMER REGISTRATION
    if (role === "customer") {
      const provisionedRole = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() === email ? "admin" as const : "customer" as const;


      // Complete the account created by the verified signup challenge.
      const { data: authUser, error: authErr } = await supabase.auth.admin.updateUserById(verified.user.id, {
        email,
        password,
        email_confirm: true,
        app_metadata: { role: provisionedRole, status: "active" },
        user_metadata: {
          role: provisionedRole,
          full_name: name,
          phone: phone || "",
        },
      });

      if (authErr || !authUser.user) return NextResponse.json({ success: false, error: authError(authErr || {}, "Account could not be completed. Please try again.") }, { status: 400 });
      const customerId = authUser.user.id;

      // Insert into public.profiles
      try {
        await supabase.from("profiles").upsert({
          id: customerId,
          full_name: name,
          phone: phone || null,
          role: provisionedRole,
        });
      } catch (e) {
        console.warn("Profile upsert notice:", e);
      }

      const sessionUser: AuthUser = {
        id: customerId,
        role: provisionedRole,
        name,
        email,
        phone: phone || "",
      };

      const token = signSession(sessionUser);
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      (await cookies()).delete("zuppo_signup_proof");
      return NextResponse.json({
        success: true,
        message: "Customer account created successfully!",
        user: sessionUser,
        status: "active",
      });
    }

    // 2. RESTAURANT PARTNER REGISTRATION (PENDING KYC APPROVAL)
    if (role === "partner") {


      const resolvedKitchenName = kitchenName?.trim() || `${name}'s Kitchen`;
      const slug =
        resolvedKitchenName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Math.floor(100 + Math.random() * 900);

      const kycData = {
        ownerName: name,
        ownerEmail: email,
        ownerPhone: phone,
        fssaiNumber: fssaiNumber?.trim() || "N/A",
        panNumber: panNumber?.trim() || "N/A",
        aadhaarNumber: aadhaarNumber?.trim() || "N/A",
        panDocUrl: panDocUrl || null,
        aadhaarDocUrl: aadhaarDocUrl || null,
        appliedAt: new Date().toISOString(),
        status: "pending_verification",
      };

      // Create Restaurant record (Blocked until Admin approves)
      const { data: restData, error: restErr } = await supabase
        .from("restaurants")
        .insert({
          name: resolvedKitchenName,
          slug,
          cuisine: cuisine?.trim() || "North Indian, Fast Food",
          phone: phone?.trim() || "+91 98261 44551",
          area: area?.trim() || "Gandhi Chowk",
          address: `${address?.trim() || area || "Main Road"}, Ambikapur`,
          is_open: false,
          is_blocked: true, // Requires Admin KYC approval
          commission_percent: 20.0,
          delivery_time_text: "25-30 min",
          banner_url:
            bannerUrl ||
            "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
        })
        .select()
        .single();

      if (restErr) {
        console.error("Restaurant create error:", restErr);
        return NextResponse.json(
          { success: false, error: `Database error: ${restErr.message}` },
          { status: 500 }
        );
      }

      // Store partner credentials and KYC in Supabase auth user
      const { data: authUser, error: authErr } = await supabase.auth.admin.updateUserById(verified.user.id, {
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "partner", restaurantId: restData.id, status: "pending_verification" },
        user_metadata: {
          role: "partner",
          full_name: name,
          restaurantId: restData.id,
          restaurantName: restData.name,
          phone,
          kyc: kycData,
          status: "pending_verification",
        },
      });

      if (authErr || !authUser.user) {
        const {error:cleanupError}=await supabase.from("restaurants").delete().eq("id",restData.id);
        if(cleanupError)console.error("Incomplete partner kitchen cleanup failed",cleanupError.code);
        return NextResponse.json({ success: false, error: authError(authErr || {}, "Partner account could not be completed. Please try again.") }, { status: 503 });
      }
      (await cookies()).delete("zuppo_signup_proof");
      return NextResponse.json({
        success: true,
        status: "pending_verification",
        message:
          "Registration & KYC submitted! Your kitchen application is now under review by Ambikapur Admin.",
        restaurantId: restData.id,
      });
    }

    // 3. RIDER REGISTRATION (PENDING FLEET APPROVAL)
    if (role === "rider") {


      const riderKyc = {
        name,
        email,
        phone,
        vehicleNumber: vehicleNumber?.trim() || "CG 15 AB 1001",
        dlNumber: dlNumber?.trim() || "N/A",
        aadhaarNumber: aadhaarNumber?.trim() || "N/A",
        dlDocUrl: dlDocUrl || null,
        aadhaarDocUrl: aadhaarDocUrl || null,
        appliedAt: new Date().toISOString(),
        status: "pending_verification",
      };

      // Create Rider profile in Supabase Auth
      const { data: authUser, error: authErr } = await supabase.auth.admin.updateUserById(verified.user.id, {
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "rider", status: "pending_verification" },
        user_metadata: {
          role: "rider",
          full_name: name,
          phone,
          vehicle: vehicleNumber?.trim() || "Hero Splendor (CG 15)",
          kyc: riderKyc,
          status: "pending_verification",
        },
      });

      if (authErr || !authUser.user) return NextResponse.json({ success: false, error: authError(authErr || {}, "Rider account could not be completed. Please try again.") }, { status: 503 });
      (await cookies()).delete("zuppo_signup_proof");
      return NextResponse.json({
        success: true,
        status: "pending_verification",
        message:
          "Rider onboarding application submitted! Admin will verify your DL & Aadhaar to activate your fleet account.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid role specified." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Register endpoint exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
