import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomInt, randomUUID } from "crypto";
import { storeOtp, maySendOtp } from "@/lib/otpStore";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim() || "Foodie";
    const role = body.role || "customer";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Generate random 6-digit OTP
    if (!maySendOtp(email)) return NextResponse.json({ success: false, error: "Please wait 60 seconds before requesting another code." }, { status: 429 });
    const otp = randomInt(100000, 1000000).toString();
    const challenge = randomUUID();

    // Store in OTP cache
    storeOtp(email, otp, challenge);

    const roleTitleMap: Record<string, string> = {
      customer: "Customer Account Verification",
      partner: "Restaurant Partner Registration",
      rider: "Rider Fleet Onboarding",
      admin: "Admin Access Verification",
    };

    const roleTitle = roleTitleMap[role] || "Account Verification";

    // Send email via Brevo
    const emailRes = await sendOtpEmail(email, name, otp, roleTitle);

    if (!emailRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: emailRes.error || "Failed to dispatch email via Brevo. Please check API key.",
        },
        { status: 500 }
      );
    }

    (await cookies()).set("zuppo_otp_challenge", challenge, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process OTP request" },
      { status: 500 }
    );
  }
}
