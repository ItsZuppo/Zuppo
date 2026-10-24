import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyOtpCode } from "@/lib/otpStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const otp = body.otp?.trim();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP code are required." },
        { status: 400 }
      );
    }

    const verification = verifyOtpCode(email, otp, (await cookies()).get("zuppo_otp_challenge")?.value || "");

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.reason || "Invalid OTP code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
