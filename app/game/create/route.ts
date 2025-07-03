import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { host_user_id, playlist_id, tracks } = await req.json();

  // Insert game
  const { data: game, error: gameError } = await supabase
    .from("games")
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

  console.log("game", game);

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message || "Failed to create game" }, { status: 500 });
  }

  // Add host to game_users
  await supabase.from("game_users").insert([
    { game_id: game.id, user_id: host_user_id, user_name: host_user_id },
  ]);

  return NextResponse.json({ gameId: game.id });
} 