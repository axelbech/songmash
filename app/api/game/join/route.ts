import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { game_id, user_id, user_name } = await req.json();

  // Check if user already in game
  const { data: existing } = await supabase
    .from("game_users")
    .select("id")
    .eq("game_id", game_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("game_users").insert({
      game_id,
      user_id,
      user_name,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
} 