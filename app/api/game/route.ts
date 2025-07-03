import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const game_id = searchParams.get("game_id");

  if (!game_id) {
    return NextResponse.json({ error: "Missing game_id" }, { status: 400 });
  }

  // Fetch the game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", game_id)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message || "Game not found" }, { status: 404 });
  }

  // Fetch users in the game
  const { data: users, error: usersError } = await supabase
    .from("game_users")
    .select("user_id, user_name")
    .eq("game_id", game_id);

  return NextResponse.json({ game, users });
} 