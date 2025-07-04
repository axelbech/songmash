"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Track, BracketMatchup } from "@/app/lib/definitions";

export default function HostGamePage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [game, setGame] = useState<any>(null);
  const [bracket, setBracket] = useState<BracketMatchup[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatchupIdx, setCurrentMatchupIdx] = useState(0);
  const [votes, setVotes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState<any>(null);

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
        setUsers([]);
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
    };
    pollVotes();
    const interval = setInterval(pollVotes, 2000);
    return () => clearInterval(interval);
  }, [game, currentRound, currentMatchupIdx]);

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

  const handleAdvance = async () => {
    await fetch("/api/game/by_code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "advance" }),
    });
    // Refetch game state
    const res = await fetch(`/api/game/by_code?code=${code}`);
    const data = await res.json();
    setGame(data.game);
    setBracket(data.game?.bracket || []);
    setCurrentRound(data.game?.current_round || 0);
    setCurrentMatchupIdx(data.game?.current_matchup_idx || 0);
    setUsers(data.users || []);
    setWinner(data.game?.winner || null);
  };

  if (loading) return <div className="p-8 text-center">Loading game...</div>;
  if (!game) return <div className="p-8 text-center">Game not found.</div>;

  const matchup = bracket?.[currentRound]?.[currentMatchupIdx];
  if (!matchup) return <div className="p-8 text-center">No matchup found.</div>;

  // Group votes by track, but map user_id to user_name
  const userIdToName: Record<string, string> = {};
  users.forEach((u: any) => {
    userIdToName[u.user_id] = u.user_name || u.user_id;
  });
  const votesByTrack: Record<string, string[]> = {};
  votes.forEach((v) => {
    if (!votesByTrack[v.track_id]) votesByTrack[v.track_id] = [];
    votesByTrack[v.track_id].push(v.user_id);
  });

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
      <div className="w-full max-w-4xl mb-8">
        <h3 className="text-lg font-bold mb-2">Tournament Bracket</h3>
        <div className="flex flex-col gap-4">
          {bracket.map((round, roundIdx) => (
            <div key={roundIdx} className="border-b pb-2 mb-2">
              <div className="font-semibold mb-1">Round {roundIdx + 1}</div>
              <div className="flex flex-wrap gap-4">
                {round.map((matchup, matchupIdx) => (
                  <div
                    key={matchupIdx}
                    className="p-2 border rounded min-w-[200px] bg-white shadow-sm"
                    style={{
                      background:
                        roundIdx === currentRound && matchupIdx === currentMatchupIdx
                          ? "#e0f2fe"
                          : "white",
                    }}
                  >
                    <div>
                      <span className="font-medium">{matchup.trackA.name}</span>
                      {" vs "}
                      <span className="font-medium">{matchup.trackB.name}</span>
                    </div>
                    {matchup.winner && (
                      <div className="text-green-700 text-xs mt-1">
                        Winner: {matchup.winner.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">Round {currentRound + 1} - Matchup {currentMatchupIdx + 1}</h3>
      <div className="flex flex-row gap-12 justify-center items-center">
        {[matchup.trackA, matchup.trackB].map((track) => (
          <div key={track.id} className="flex flex-col items-center">
            <iframe
              src={`https://open.spotify.com/embed/track/${track.id}`}
              width="500"
              height="300"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded -lg"
              title={`Spotify player for ${track.id}`}
            ></iframe>
            <div className="mt-2 text-sm text-gray-800 font-semibold">Voted by:</div>
            <div style={{ position: 'relative', minHeight: 48, minWidth: 120, marginBottom: 8 }}>
              {(votesByTrack[track.id] || []).map((userId, idx) => {
                // Generate a random offset for each bubble (stable per userId+track)
                const hash = (userId + track.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                const x = Math.sin(hash) * 20; // -20 to +20 px
                const y = Math.cos(hash) * 12; // -12 to +12 px
                return (
                  <div
                    key={userId}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 1,
                      background: '#f0f4ff',
                      borderRadius: 9999,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      padding: '6px 14px',
                      fontWeight: 600,
                      color: '#2d3a5a',
                      fontSize: 14,
                      transition: 'all 0.2s',
                      pointerEvents: 'none',
                    }}
                  >
                    {userIdToName[userId] || userId}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-gray-500">Total votes: {(votesByTrack[track.id] || []).length}</div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h4 className="font-semibold mb-1">Users in game:</h4>
        <ul className="text-sm text-gray-700">
          {[...new Map(users.map((u: any) => [u.user_id, u])).values()].map((u: any) => (
            <li key={u.user_id}>{u.user_name || u.user_id}</li>
          ))}
        </ul>
      </div>
      <button
        className="mt-8 rounded bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 font-bold "
        onClick={handleAdvance}
      >
        Next
      </button>
    </div>
  );
} 