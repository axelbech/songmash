import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { host_user_id, playlist_id, tracks } = await req.json();

  // Insert session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert([
      {
        host_user_id,
        playlist_id,
        tracks,
        current_round: 0,
        current_matchup_idx: 0,
      },
    ])
    .select()
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message || "Failed to create session" }, { status: 500 });
  }

  // Add host to session_users
  await supabase.from("session_users").insert([
    { session_id: session.id, user_id: host_user_id, user_name: host_user_id },
  ]);

  return NextResponse.json({ sessionId: session.id });
} 