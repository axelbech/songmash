import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { session_id, user_id, user_name } = await req.json();

  // Check if user already in session
  const { data: existing } = await supabase
    .from("session_users")
    .select("id")
    .eq("session_id", session_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("session_users").insert([
      { session_id, user_id, user_name },
    ]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
} 