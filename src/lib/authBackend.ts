import { createClient } from "@supabase/supabase-js";
export function authBackend() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error("Login service is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.");
 if ((process.env.AUTH_SECRET || "").length < 32) throw new Error("Set AUTH_SECRET (at least 32 characters) in Vercel and redeploy.");
 return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export function authError(error: { status?: number; code?: string }, fallback: string) {
 if (error.status === 401 || error.status === 403 || error.code === "bad_jwt") return "Login configuration is invalid. Check the Supabase server key in Vercel and redeploy.";
 if (error.code === "email_exists" || error.code === "user_already_exists") return "This email already has an account. Sign in or use Forgot password.";
 if (error.code === "weak_password") return "Please choose a stronger password.";
 if (error.status && error.status >= 500) return "Account service is temporarily unavailable. Please try again shortly.";
 return fallback;
}
