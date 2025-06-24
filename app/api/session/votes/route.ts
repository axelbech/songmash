import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const session_id = searchParams.get("session_id");
  const round = searchParams.get("round");
  const matchup_idx = searchParams.get("matchup_idx");

  if (!session_id || !round || !matchup_idx) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const { data: votes, error } = await supabase
    .from("votes")
    .select("user_id, track_id")
    .eq("session_id", session_id)
    .eq("round", round)
    .eq("matchup_idx", matchup_idx);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ votes });
} 