import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authBackend } from "@/lib/authBackend";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
export async function POST(req: Request) {
 try {
  const {email,otp,password} = await req.json();
  if (typeof email!=="string" || typeof otp!=="string" || !/^\d{6,10}$/.test(otp.trim()) || typeof password!=="string" || password.length<6) return NextResponse.json({success:false,error:"Enter your email, verification code and a password of at least 6 characters."},{status:400});
  const client=authBackend();
  const {data,error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token:otp.trim(),type:"recovery"});
  if(error || !data.user || !data.session) return NextResponse.json({success:false,error:"Invalid or expired reset code. Request a new code."},{status:400});
  const {error:updateError}=await client.auth.admin.updateUserById(data.user.id,{password, app_metadata: { password_changed_at: Date.now() }});
  if(updateError) return NextResponse.json({success:false,error:"Password could not be changed. Request a fresh code and try again."},{status:503});
  await client.auth.admin.signOut(data.session.access_token,"global");
  const cookieStore=await cookies(); cookieStore.delete(SESSION_COOKIE_NAME); cookieStore.delete("zuppo_signup_proof");
  return NextResponse.json({success:true,message:"Password changed. Sign in with your new password."});
 } catch { return NextResponse.json({success:false,error:"Password reset is temporarily unavailable."},{status:503}); }
}
