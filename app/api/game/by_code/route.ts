import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../utils/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Fetch the game by code
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("code", code)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message || "Game not found" }, { status: 404 });
  }

  // Fetch users in the game
  const { data: users, error: usersError } = await supabase
    .from("game_users")
    .select("user_id, user_name")
    .eq("game_id", game.id);

  return NextResponse.json({ game, users });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { code, action } = await req.json();

  if (!code || action !== "advance") {
    return NextResponse.json({ error: "Missing code or invalid action" }, { status: 400 });
  }

  // Fetch the game by code
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("code", code)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message || "Game not found" }, { status: 404 });
  }

  let bracket = game.bracket || [];
  let currentRound = game.current_round || 0;
  let currentMatchupIdx = game.current_matchup_idx || 0;

  // Get votes for this matchup
  const { data: votes } = await supabase
    .from("votes")
    .select("track_id")
    .eq("game_id", game.id)
    .eq("round", currentRound)
    .eq("matchup_idx", currentMatchupIdx);

  // Tally votes
  const voteCounts: Record<string, number> = {};
  votes?.forEach((v: any) => {
    voteCounts[v.track_id] = (voteCounts[v.track_id] || 0) + 1;
  });

  function minimalTrack(track: any) {
    return {
      id: track.id,
      name: track.name,
      artists: Array.isArray(track.artists)
        ? track.artists.map((a: any) => (typeof a === 'string' ? a : a.name))
        : track.artists,
      album: {
        name: track.album?.name,
        image: track.album?.images?.[0]?.url || track.album?.image,
      },
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
    };
  }

  // Determine winner for this matchup
  const matchup = bracket?.[currentRound]?.[currentMatchupIdx];
  if (matchup) {
    let winner: any = undefined;
    if (voteCounts[matchup.trackA.id] > (voteCounts[matchup.trackB.id] || 0)) {
      winner = minimalTrack(matchup.trackA);
    } else if (voteCounts[matchup.trackB.id] > (voteCounts[matchup.trackA.id] || 0)) {
      winner = minimalTrack(matchup.trackB);
    } else {
      // Tie or no votes: pick randomly
      winner = minimalTrack(Math.random() < 0.5 ? matchup.trackA : matchup.trackB);
    }
    bracket[currentRound][currentMatchupIdx].winner = winner;
  }
  console.log("hello")
  // Always advance matchup or round, even if no votes
  let nextRound = currentRound;
  let nextMatchupIdx = currentMatchupIdx + 1;
  if (nextMatchupIdx >= bracket[currentRound].length) {
    // Round finished, prepare next round
    const winners = bracket[currentRound].map((m: any) => m.winner).filter(Boolean).map(minimalTrack);
    let oddTrack: any | null = null;
    if (winners.length % 2 === 1) {
      oddTrack = winners.pop();
    }
    if (winners.length === 0 && oddTrack) {
      // Tournament winner
      await supabase.from("games").update({
        bracket,
        current_round: currentRound,
        current_matchup_idx: currentMatchupIdx,
        winner: oddTrack,
      }).eq("id", game.id);
      return NextResponse.json({ bracket, winner: oddTrack });
    } else if (winners.length === 1) {
      // Tournament winner
      await supabase.from("games").update({
        bracket,
        current_round: currentRound,
        current_matchup_idx: currentMatchupIdx,
        winner: winners[0],
      }).eq("id", game.id);
      return NextResponse.json({ bracket, winner: winners[0] });
    } else {
      // Pair winners for next round
      const nextMatchups: any[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        if (winners[i + 1]) {
          nextMatchups.push({ trackA: minimalTrack(winners[i]), trackB: minimalTrack(winners[i + 1]) });
        } else {
          oddTrack = winners[i];
        }
      }
      if (oddTrack) nextMatchups.push({ trackA: minimalTrack(oddTrack), trackB: minimalTrack(oddTrack) });
      bracket.push(nextMatchups);
      nextRound = currentRound + 1;
      nextMatchupIdx = 0;
    }
  }
  console.log("goodbye")
  // Update game state
  await supabase.from("games").update({
    bracket,
    current_round: nextRound,
    current_matchup_idx: nextMatchupIdx,
    winner: null,
  }).eq("id", game.id);

  return NextResponse.json({ bracket });
} 