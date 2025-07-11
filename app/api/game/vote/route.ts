import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { game_id, round, matchup_idx, user_id, track_id } = await req.json();

  const { error } = await supabase.from("votes").insert({
    game_id,
    round: Number(round),
    matchup_idx: Number(matchup_idx),
    user_id,
    track_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
} 