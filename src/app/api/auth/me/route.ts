import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({
      success: true,
      authenticated: Boolean(user),
      user: user || null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
