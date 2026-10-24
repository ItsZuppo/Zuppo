import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { authBackend, authError } from "@/lib/authBackend";
import { sendOtpEmail } from "@/lib/email";
export async function POST(req: Request) {
 try {
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({success:false,error:"Enter a valid email address."},{status:400});
  const cookieStore = await cookies();
  if (cookieStore.get("zuppo_otp_cooldown")) return NextResponse.json({success:false,error:"Please wait 60 seconds before requesting another code."},{status:429});
  const recovery = body.purpose === "recovery";
  const client = authBackend();
  let {data,error} = await client.auth.admin.generateLink(recovery ? {type:"recovery",email} : {type:"signup",email,password:randomBytes(32).toString("base64url")});
  let verificationType = "signup";
  // Resume an email-verified signup whose final registration was interrupted.
  if (!recovery && error && ["email_exists", "user_already_exists"].includes(error.code || "")) {
    const resumed = await client.auth.admin.generateLink({type:"recovery",email});
    if (!resumed.error && resumed.data.user && !resumed.data.user.app_metadata?.role) {
      data = resumed.data; error = null; verificationType = "recovery";
    }
  }
  const options = {httpOnly:true,sameSite:"strict" as const,secure:process.env.NODE_ENV==="production",path:"/"};
  cookieStore.set("zuppo_otp_cooldown","1",{...options,maxAge:60});
  if (error || !data.properties?.email_otp) {
   if (recovery && error?.code==="user_not_found") return NextResponse.json({success:true,message:"If this email has an account, a reset code will arrive shortly."});
   console.error("OTP generation failed",error?.code,error?.status);
   return NextResponse.json({success:false,error:authError(error || {},"Could not start email verification. Try signing in or use Forgot password.")},{status:400});
  }
  const sent = await sendOtpEmail(email,"Foodie",data.properties.email_otp,recovery ? "Password Reset" : "Account Verification");
  if (!sent.success) return NextResponse.json({success:false,error:"Verification email could not be sent. Please try again shortly."},{status:503});
  cookieStore.delete("zuppo_signup_proof");
  if (!recovery) cookieStore.set("zuppo_signup_type",verificationType,{...options,maxAge:600});
  return NextResponse.json({success:true,message:recovery ? "If this email has an account, a reset code will arrive shortly." : "Verification code sent. Check your inbox and spam folder."});
 } catch(error) {
  return NextResponse.json({success:false,error:error instanceof Error ? error.message : "Email verification unavailable."},{status:503});
 }
}
