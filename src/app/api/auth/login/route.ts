import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authBackend, authError } from "@/lib/authBackend";
import {
  AuthUser,
  temporaryLogin,
  KITCHEN_CREDENTIALS,
  RIDER_CREDENTIALS,
  ADMIN_CREDENTIALS,
  signSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const supabase = authBackend();
    const body = await req.json();
    const { role, username, password, phone, customerName } = body;
    const cleanUser = typeof username === "string" ? username.trim().toLowerCase() : "";
    const cleanPass = typeof password === "string" ? password : "";

    let authenticatedUser: AuthUser | null = role !== "admin" ? null : temporaryLogin(role, cleanUser, cleanPass || "");

    // 1. Restaurant Partner Login
    if (authenticatedUser) {
      // Local temporary login already verified above.
    } else if (role === "partner") {
      // A. Check Seeded / Built-in Kitchens
      const match = process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_LOGIN === "true" && KITCHEN_CREDENTIALS.find(
        (k) =>
          (k.username.toLowerCase() === cleanUser ||
            k.email.toLowerCase() === cleanUser ||
            k.phone.replace(/\s+/g, "") === cleanUser.replace(/\s+/g, "")) &&
          k.password === cleanPass
      );

      if (match) {
        authenticatedUser = {
          id: `partner-${match.username}`,
          role: "partner",
          name: match.restaurantName,
          phone: match.phone,
          email: match.email,
          restaurantId: match.restaurantId,
          restaurantName: match.restaurantName,
        };
      } else {
        // B. Check Dynamic Supabase Registered Partners
        const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanUser,
          password: cleanPass,
        });

        if (supaErr || !supaAuth.user) {
          return NextResponse.json(
            { success: false, error: "Invalid kitchen email or password." },
            { status: 401 }
          );
        }

        const meta = supaAuth.user.user_metadata || {};
        const trusted = supaAuth.user.app_metadata || {};
        if (trusted.role !== "partner" || trusted.status !== "active") return NextResponse.json({ success: false, error: "Partner approval required. Ask admin to approve your account." }, { status: 403 });
        const restId = trusted.restaurantId;

        // Verify KYC approval status in restaurants table
        if (restId) {
          const { data: restRecord } = await supabase
            .from("restaurants")
            .select("is_blocked, is_open, name")
            .eq("id", restId)
            .maybeSingle();

          if (restRecord?.is_blocked) {
            return NextResponse.json(
              {
                success: false,
                status: "pending_verification",
                error:
                  "Your kitchen application is currently under verification by Ambikapur Admin. Once verified, you will be able to log in and receive orders.",
              },
              { status: 403 }
            );
          }

          authenticatedUser = {
            id: supaAuth.user.id,
            role: "partner",
            name: restRecord?.name || meta.restaurantName || "Partner Kitchen",
            email: supaAuth.user.email,
            phone: meta.phone,
            restaurantId: restId,
            restaurantName: restRecord?.name || meta.restaurantName,
          };
        } else {
          return NextResponse.json(
            { success: false, error: "Kitchen profile not bound to this account." },
            { status: 400 }
          );
        }
      }
    }

    // 2. Delivery Rider Login
    else if (role === "rider") {
      // A. Check Seeded Rider
      const match = process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_LOGIN === "true" && RIDER_CREDENTIALS.find(
        (r) =>
          (r.username.toLowerCase() === cleanUser ||
            r.email.toLowerCase() === cleanUser ||
            r.phone.replace(/\s+/g, "") === cleanUser.replace(/\s+/g, "")) &&
          r.password === cleanPass
      );

      if (match) {
        authenticatedUser = {
          id: match.id,
          role: "rider",
          name: match.name,
          phone: match.phone,
          email: match.email,
          vehicle: match.vehicle,
        };
      } else {
        // B. Check Dynamic Supabase Rider
        const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanUser,
          password: cleanPass,
        });

        if (supaErr || !supaAuth.user) {
          return NextResponse.json(
            { success: false, error: "Invalid rider email or password." },
            { status: 401 }
          );
        }

        const meta = supaAuth.user.user_metadata || {};
        if (supaAuth.user.app_metadata?.role !== "rider" || supaAuth.user.app_metadata?.status !== "active") {
          return NextResponse.json(
            {
              success: false,
              status: "pending_verification",
              error:
                "Your Rider KYC documents are under review by Ambikapur Fleet Admin. We will activate your account shortly.",
            },
            { status: 403 }
          );
        }

        authenticatedUser = {
          id: supaAuth.user.id,
          role: "rider",
          name: meta.full_name || "Ambikapur Rider",
          phone: meta.phone,
          email: supaAuth.user.email,
          vehicle: meta.vehicle || "Hero Splendor (CG 15)",
        };
      }
    }

    // 3. Super Admin Login
    else if (role === "admin") {
      if (
        process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_LOGIN === "true" &&
        (ADMIN_CREDENTIALS.username === cleanUser ||
          ADMIN_CREDENTIALS.email === cleanUser) &&
        ADMIN_CREDENTIALS.password === cleanPass
      ) {
        authenticatedUser = {
          id: ADMIN_CREDENTIALS.id,
          role: "admin",
          name: ADMIN_CREDENTIALS.name,
          email: ADMIN_CREDENTIALS.email,
        };
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanUser, password: cleanPass || "" });
        if (error || data.user?.app_metadata?.role !== "admin") return NextResponse.json({ success: false, error: "Invalid admin credentials." }, { status: 401 });
        authenticatedUser = { id: data.user.id, role: "admin", name: data.user.user_metadata?.full_name || "Admin", email: data.user.email };
      }
    }

    // 4. Customer Login
    else if (role === "customer") {
      if (cleanPass) {
        // Email + Password Login
        const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanUser,
          password: cleanPass,
        });

        if (supaErr || !supaAuth.user) {
          return NextResponse.json(
            { success: false, error: authError(supaErr || {}, "Invalid email or password. Use Forgot password to reset it.") },
            { status: 401 }
          );
        }

        if (supaAuth.user.app_metadata?.role !== "customer") return NextResponse.json({ success: false, error: "Use the correct portal for your account, or finish registration." }, { status: 403 });
        const meta = supaAuth.user.user_metadata || {};
        authenticatedUser = {
          id: supaAuth.user.id,
          role: "customer",
          name: meta.full_name || "Ambikapur Customer",
          avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : "",
          email: supaAuth.user.email,
          phone: meta.phone,
        };
      } else {
        return NextResponse.json({ success: false, error: "Please sign in with your email and password." }, { status: 401 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid role specified." }, { status: 400 });
    }

    // Create cryptographically signed session token
    const token = signSession(authenticatedUser);

    // Set secure HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: authenticatedUser,
      message: `Welcome back, ${authenticatedUser.name}!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
