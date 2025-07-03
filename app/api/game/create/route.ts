import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

function generateInitialBracket(tracks: any[]) {
  // Shuffle tracks
  const shuffled = [...tracks].sort(() => 0.5 - Math.random());
  // Pair into matchups
  const matchups = [];
  let oddTrack = null;
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matchups.push({ trackA: shuffled[i], trackB: shuffled[i + 1] });
    } else {
      oddTrack = shuffled[i];
    }
  }
  // Optionally, you could store oddTrack for next round, but for now just return the first round
  return [matchups];
}

function generateGameCode(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { host_user_id, playlist_id, tracks } = await req.json();

  // Generate initial bracket
  const bracket = generateInitialBracket(tracks);

  // Generate a unique game code
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = generateGameCode();
    const { data: existing } = await supabase.from("games").select("id").eq("code", code).maybeSingle();
    if (!existing) isUnique = true;
  }

  // Insert game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert([
      {
        host_user_id,
        playlist_id,
        tracks,
        bracket,
        code,
        current_round: 0,
        current_matchup_idx: 0,
      },
    ])
    .select()
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message || "Failed to create game" }, { status: 500 });
  }

  // Add host to game_users
  await supabase.from("game_users").insert([
    { game_id: game.id, user_id: host_user_id, user_name: host_user_id },
  ]);

  return NextResponse.json({ gameId: game.id, code: game.code });
} 