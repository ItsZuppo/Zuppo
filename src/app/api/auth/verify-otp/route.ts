import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authBackend } from "@/lib/authBackend";
export async function POST(req: Request) {
 try {
  const {email,otp} = await req.json();
  if (typeof email!=="string" || typeof otp!=="string" || !/^\d{6,10}$/.test(otp.trim())) return NextResponse.json({success:false,error:"Enter the complete email verification code."},{status:400});
  const type = (await cookies()).get("zuppo_signup_type")?.value === "recovery" ? "recovery" : "signup";
  const {data,error} = await authBackend().auth.verifyOtp({email:email.trim().toLowerCase(),token:otp.trim(),type});
  if (error || !data.session) return NextResponse.json({success:false,error:"Invalid or expired code. Please request a new code."},{status:400});
  (await cookies()).set("zuppo_signup_proof",data.session.access_token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:600,path:"/"});
  return NextResponse.json({success:true,message:"Email verified. Complete your registration."});
 } catch {
  return NextResponse.json({success:false,error:"Email verification is unavailable. Please try again."},{status:503});
 }
}
