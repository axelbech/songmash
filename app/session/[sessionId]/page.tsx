"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

interface BracketMatchup {
  trackA: Track;
  trackB: Track;
  winner?: Track;
}

export default function SessionPage() {
  const { data: session } = useSession();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [sessionData, setSessionData] = useState<any>(null);
  const [bracket, setBracket] = useState<BracketMatchup[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatchupIdx, setCurrentMatchupIdx] = useState(0);
  const [votes, setVotes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Join session on mount
  useEffect(() => {
    if (!session || !sessionId) return;
    const join = async () => {
      await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: session.user?.email || session.user?.name || "unknown",
          user_name: session.user?.name || session.user?.email || "unknown",
        }),
      });
    };
    join();
  }, [session, sessionId]);

  // Fetch session data
  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      setLoading(true);
      const res = await fetch(`/api/supabase/session?session_id=${sessionId}`);
      const data = await res.json();
      setSessionData(data.session);
      setBracket(data.session?.bracket || []);
      setCurrentRound(data.session?.current_round || 0);
      setCurrentMatchupIdx(data.session?.current_matchup_idx || 0);
      setUsers(data.users || []);
      setLoading(false);
    };
    fetchSession();
  }, [sessionId]);

  // Poll votes for current matchup
  useEffect(() => {
    if (!sessionId) return;
    const pollVotes = async () => {
      const res = await fetch(`/api/session/votes?session_id=${sessionId}&round=${currentRound}&matchup_idx=${currentMatchupIdx}`);
      const data = await res.json();
      setVotes(data.votes || []);
    };
    pollVotes();
    const interval = setInterval(pollVotes, 2000);
    return () => clearInterval(interval);
  }, [sessionId, currentRound, currentMatchupIdx]);

  // Voting handler
  const handleVote = async (trackId: string) => {
    if (!session || !sessionId) return;
    await fetch("/api/session/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        round: currentRound,
        matchup_idx: currentMatchupIdx,
        user_id: session.user?.email || session.user?.name || "unknown",
        track_id: trackId,
      }),
    });
  };

  if (loading) return <div className="p-8 text-center">Loading session...</div>;
  if (!sessionData) return <div className="p-8 text-center">Session not found.</div>;

  const matchup = bracket?.[currentRound]?.[currentMatchupIdx];
  if (!matchup) return <div className="p-8 text-center">No matchup found.</div>;

  // Group votes by track
  const votesByTrack: Record<string, string[]> = {};
  votes.forEach((v) => {
    if (!votesByTrack[v.track_id]) votesByTrack[v.track_id] = [];
    votesByTrack[v.track_id].push(v.user_id);
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h2 className="text-xl font-bold mb-4">Session: {sessionId}</h2>
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
              className="rounded shadow-lg"
              title={`Spotify player for ${track.id}`}
            ></iframe>
            <button
              className="rounded bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 font-semibold shadow mt-2 w-full max-w-xs"
              onClick={() => handleVote(track.id)}
            >
              Vote
            </button>
            <div className="mt-2 text-sm text-gray-800">
              Voted by: {votesByTrack[track.id]?.join(", ") || "No votes yet"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h4 className="font-semibold mb-1">Users in session:</h4>
        <ul className="text-sm text-gray-700">
          {users.map((u) => (
            <li key={u.user_id}>{u.user_name || u.user_id}</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 