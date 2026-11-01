import { siteUrl } from "@/lib/site";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash"),
    type = request.nextUrl.searchParams.get("type");
  if (
    token_hash &&
    (type === "signup" || type === "recovery" || type === "email")
  ) {
    const { error } = await (
      await supabase()
    ).auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery" ? "/reset-password" : "/marketplace",
          siteUrl(),
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", request.url),
  );
}
