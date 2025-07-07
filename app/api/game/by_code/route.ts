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

  // Use the new explicit bracket format
  let bracket = (game.bracket || { rounds: [] }) as any;
  let currentRound = game.current_round || 0;
  let currentMatchupIdx = game.current_matchup_idx || 0;

  // Get the current round and matchup
  const roundObj = bracket.rounds[currentRound];
  const matchup = roundObj?.matches?.[currentMatchupIdx];

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


  // Determine winner for this matchup
  if (matchup) {
    const votesA = voteCounts[matchup.trackA_id] || 0;
    const votesB = matchup.trackB_id ? (voteCounts[matchup.trackB_id] || 0) : 0;
    let winner_track_id = null;
    if (votesA > votesB) {
      winner_track_id = matchup.trackA_id;
    } else if (votesB > votesA) {
      winner_track_id = matchup.trackB_id;
    } else {
      // Tie or no votes: pick randomly
      winner_track_id = Math.random() < 0.5 ? matchup.trackA_id : matchup.trackB_id;
    }
    matchup.winner_track_id = winner_track_id;
    matchup.votes_trackA = votesA;
    matchup.votes_trackB = votesB;
  }

  // Always advance matchup or round, even if no votes
  let nextRound = currentRound;
  let nextMatchupIdx = currentMatchupIdx + 1;
  if (nextMatchupIdx >= roundObj.matches.length) {
    // Round finished, prepare next round
    const winners = roundObj.matches.map((m: any) => m.winner_track_id).filter(Boolean);
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
      const nextMatches: any[] = [];
      let nextMatchupIdxGen = 0;
      for (let i = 0; i < winners.length; i += 2) {
        if (winners[i + 1]) {
          nextMatches.push({
            match_id: `${currentRound + 2}-${nextMatchupIdxGen + 1}`,
            trackA_id: winners[i],
            trackB_id: winners[i + 1],
            winner_track_id: null,
            votes_trackA: 0,
            votes_trackB: 0
          });
        } else {
          nextMatches.push({
            match_id: `${currentRound + 2}-${nextMatchupIdxGen + 1}`,
            trackA_id: winners[i],
            trackB_id: null,
            winner_track_id: winners[i],
            votes_trackA: 0,
            votes_trackB: 0
          });
        }
        nextMatchupIdxGen++;
      }
      bracket.rounds.push({
        round_number: currentRound + 2,
        matches: nextMatches
      });
      nextRound = currentRound + 1;
      nextMatchupIdx = 0;
    }
  }

  const { data: updatedGame, error: updateError } = await supabase.from("games").update({
    bracket,
    current_round: nextRound,
    current_matchup_idx: nextMatchupIdx,
  }).eq("id", game.id);

  if (updateError) {
    console.log(updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }


  return NextResponse.json({ bracket });
} 