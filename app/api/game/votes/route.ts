import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const game_id = searchParams.get("game_id");
  const round = searchParams.get("round");
  const matchup_idx = searchParams.get("matchup_idx");

  if (!game_id || !round || !matchup_idx) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const { data: votes, error } = await supabase
    .from("votes")
    .select("user_id, track_id")
    .eq("game_id", game_id)
    .eq("round", Number(round))
    .eq("matchup_idx", Number(matchup_idx));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ votes });
} 