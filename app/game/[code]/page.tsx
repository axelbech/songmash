"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Track, BracketMatchup } from "@/app/lib/definitions";

export default function GameParticipantPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [game, setGame] = useState<any>(null);
  const [bracket, setBracket] = useState<BracketMatchup[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatchupIdx, setCurrentMatchupIdx] = useState(0);
  const [votes, setVotes] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

  // Generate a random user id for this session (could be improved with auth)
  useEffect(() => {
    let id = localStorage.getItem("songmash_user_id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      localStorage.setItem("songmash_user_id", id);
    }
    setUserId(id);
    const storedUsername = localStorage.getItem("songmash_username");
    if (!storedUsername) {
      // Redirect to username entry if not set
      router.replace(`/join/${code}`);
      return;
    }
    setUsername(storedUsername);
  }, [router, code]);

  // Fetch game data by code
  useEffect(() => {
    if (!code) return;
    const fetchGame = async () => {
      setLoading(true);
      const res = await fetch(`/api/game/by_code?code=${code}`);
      const data = await res.json();
      if (!data.game) {
        setGame(null);
        setBracket([]);
        setLoading(false);
        return;
      }
      setGame(data.game);
      setBracket(data.game?.bracket || []);
      setCurrentRound(data.game?.current_round || 0);
      setCurrentMatchupIdx(data.game?.current_matchup_idx || 0);
      setUsers(data.users || []);
      setLoading(false);
    };
    fetchGame();
  }, [code]);

  // Poll votes for current matchup
  useEffect(() => {
    if (!game) return;
    const pollVotes = async () => {
      const res = await fetch(`/api/game/votes?game_id=${game.id}&round=${currentRound}&matchup_idx=${currentMatchupIdx}`);
      const data = await res.json();
      setVotes(data.votes || []);
      setHasVoted(!!data.votes?.find((v: any) => v.user_id === userId));
    };
    pollVotes();
    const interval = setInterval(pollVotes, 2000);
    return () => clearInterval(interval);
  }, [game, currentRound, currentMatchupIdx, userId]);

  // Poll for winner
  useEffect(() => {
    if (!game) return;
    const pollWinner = async () => {
      const res = await fetch(`/api/game/by_code?code=${code}`);
      const data = await res.json();
      setWinner(data.game?.winner || null);
    };
    pollWinner();
    const interval = setInterval(pollWinner, 2000);
    return () => clearInterval(interval);
  }, [game, code]);

  // Join game on mount
  useEffect(() => {
    if (!game || !userId || !username) return;
    const join = async () => {
      await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: game.id,
          user_id: userId,
          user_name: username,
        }),
      });
    };
    join();
  }, [game, userId, username]);

  // Poll users in game
  useEffect(() => {
    if (!game) return;
    const pollUsers = async () => {
      const res = await fetch(`/api/game/by_code?code=${code}`);
      const data = await res.json();
      setUsers(data.users || []);
    };
    pollUsers();
    const interval = setInterval(pollUsers, 2000);
    return () => clearInterval(interval);
  }, [game, code]);

  const handleVote = async (trackId: string) => {
    if (!game || hasVoted || !!winner) return;
    setHasVoted(true);
    await fetch("/api/game/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_id: game.id,
        round: currentRound,
        matchup_idx: currentMatchupIdx,
        user_id: userId,
        track_id: trackId,
      }),
    });
  };

  if (loading) return <div className="p-8 text-center">Loading game...</div>;
  if (!game) return <div className="p-8 text-center">Game not found.</div>;

  const matchup = bracket?.[currentRound]?.[currentMatchupIdx];
  if (!matchup) return <div className="p-8 text-center">No matchup found.</div>;

  if (winner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h2 className="text-2xl font-bold mb-4">Winner!</h2>
        <iframe
          src={`https://open.spotify.com/embed/track/${winner.id}`}
          width="500"
          height="300"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title={`Spotify player for ${winner.id}`}
          className="rounded -lg"
        ></iframe>
        <div className="text-lg font-semibold text-gray-900 mt-4">{winner.name} by {winner.artists?.map((a: any) => a.name).join(", ")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h2 className="text-xl font-bold mb-4">Game Code: {code}</h2>
      <h3 className="text-lg font-semibold mb-2">Vote for your favorite!</h3>
      <div className="flex flex-row gap-12 justify-center items-center">
        {[matchup.trackA, matchup.trackB].map((track) => (
          <div key={track.id} className="flex flex-col items-center">
            <iframe
              src={`https://open.spotify.com/embed/track/${track.id}`}
              width="400"
              height="200"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded -lg"
              title={`Spotify player for ${track.id}`}
            ></iframe>
            <button
              className={`rounded bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-semibold  mt-2 w-full max-w-xs ${(hasVoted || !!winner) ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => handleVote(track.id)}
              disabled={hasVoted || !!winner}
            >
              {hasVoted ? "Vote submitted" : "Vote"}
            </button>
          </div>
        ))}
      </div>
      {hasVoted && <div className="mt-6 text-green-700 font-semibold">Thank you for voting!</div>}
      <div className="mt-8">
        <h4 className="font-semibold mb-1">Users in game:</h4>
        <ul className="text-sm text-gray-700">
          {[...new Map(users.map((u: any) => [u.user_id, u])).values()].map((u: any) => (
            <li key={u.user_id} style={u.user_id === userId ? { fontWeight: 700, color: '#2563eb' } : {}}>
              {u.user_name || u.user_id}
              {u.user_id === userId && ' (You)'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 