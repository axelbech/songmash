"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Playlist {
  id: string;
  name: string;
  images: { url: string }[];
}

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  preview_url?: string;
}

interface EloScores {
  [trackId: string]: number;
}

interface BracketMatchup {
  trackA: Track;
  trackB: Track;
  winner?: Track;
}

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [gameTracks, setGameTracks] = useState<Track[] | null>(null);
  const [eloScores, setEloScores] = useState<EloScores>({});
  const [bracket, setBracket] = useState<BracketMatchup[][]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentMatchupIdx, setCurrentMatchupIdx] = useState(0);
  const [tournamentWinner, setTournamentWinner] = useState<Track | null>(null);

  // ELO constants
  const INITIAL_ELO = 1000;
  const K = 32;

  // Fetch playlists
  useEffect(() => {
    const fetchPlaylists = async () => {
      if (!session || !(session.user as any)?.accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("https://api.spotify.com/v1/me/playlists", {
          headers: {
            Authorization: `Bearer ${(session.user as any).accessToken}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch playlists");
        const data = await res.json();
        setPlaylists(data.items);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchPlaylists();
  }, [session]);

  // Fetch tracks for selected playlist
  useEffect(() => {
    const fetchTracks = async () => {
      if (!selectedPlaylist || !session || !(session.user as any)?.accessToken) return;
      setLoading(true);
      setError(null);
      try {
        let allTracks: Track[] = [];
        let url = `https://api.spotify.com/v1/playlists/${selectedPlaylist.id}/tracks?limit=100`;
        while (url) {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${(session.user as any).accessToken}`,
            },
          });
          if (!res.ok) throw new Error("Failed to fetch tracks");
          const data = await res.json();
          allTracks = allTracks.concat(
            data.items
              .filter((item: any) => item.track)
              .map((item: any) => item.track)
          );
          url = data.next;
        }
        setTracks(allTracks);
        // Initialize ELO scores
        const initialScores: EloScores = {};
        allTracks.forEach((track) => {
          initialScores[track.id] = INITIAL_ELO;
        });
        setEloScores(initialScores);
        // Pick two random tracks for the game
        if (allTracks.length >= 2) {
          const shuffled = allTracks.sort(() => 0.5 - Math.random());
          setGameTracks([shuffled[0], shuffled[1]]);
        }
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    if (selectedPlaylist) fetchTracks();
  }, [selectedPlaylist, session]);

  // When tracks are loaded, initialize the bracket
  useEffect(() => {
    if (tracks && tracks.length >= 2) {
      // Shuffle tracks
      const shuffled = [...tracks].sort(() => 0.5 - Math.random());
      // Pair into matchups
      const matchups: BracketMatchup[] = [];
      let oddTrack: Track | null = null;
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          matchups.push({ trackA: shuffled[i], trackB: shuffled[i + 1] });
        } else {
          oddTrack = shuffled[i];
        }
      }
      setBracket([matchups]);
      setCurrentRound(0);
      setCurrentMatchupIdx(0);
      setTournamentWinner(null);
      // Store oddTrack for next round
      (window as any).__songmash_oddTrack = oddTrack;
    }
  }, [tracks]);

  // Handler for selecting a playlist
  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setTracks(null);
    setGameTracks(null);
  };

  // ELO calculation
  function calculateElo(winner: number, loser: number) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loser - winner) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winner - loser) / 400));
    const newWinner = winner + K * (1 - expectedWinner);
    const newLoser = loser + K * (0 - expectedLoser);
    return [newWinner, newLoser];
  }

  // Voting handler for bracket
  const handleBracketVote = (winner: Track) => {
    if (!bracket.length) return;
    const round = bracket[currentRound];
    const matchup = round[currentMatchupIdx];
    matchup.winner = winner;
    const updatedRound = [...round];
    updatedRound[currentMatchupIdx] = matchup;
    const updatedBracket = [...bracket];
    updatedBracket[currentRound] = updatedRound;
    setBracket(updatedBracket);
    // Move to next matchup or next round
    if (currentMatchupIdx < round.length - 1) {
      setCurrentMatchupIdx(currentMatchupIdx + 1);
    } else {
      // Round finished, prepare next round
      const winners = updatedRound.map((m) => m.winner!).filter(Boolean);
      // Check for odd track from previous round
      let oddTrack: Track | null = (window as any).__songmash_oddTrack || null;
      if (oddTrack) {
        winners.push(oddTrack);
        (window as any).__songmash_oddTrack = null;
      }
      if (winners.length === 1) {
        setTournamentWinner(winners[0]);
      } else {
        // Pair winners for next round
        const nextRound: BracketMatchup[] = [];
        let nextOddTrack: Track | null = null;
        for (let i = 0; i < winners.length; i += 2) {
          if (winners[i + 1]) {
            nextRound.push({ trackA: winners[i], trackB: winners[i + 1] });
          } else {
            nextOddTrack = winners[i];
          }
        }
        setBracket([...updatedBracket, nextRound]);
        setCurrentRound(currentRound + 1);
        setCurrentMatchupIdx(0);
        (window as any).__songmash_oddTrack = nextOddTrack;
      }
    }
  };

  // Leaderboard
  const leaderboard = tracks
    ? [...tracks]
        .sort((a, b) => (eloScores[b.id] || INITIAL_ELO) - (eloScores[a.id] || INITIAL_ELO))
        .slice(0, 10)
    : [];

  // Handler for starting a game
  const handleStartGame = async () => {
    if (!session || !selectedPlaylist || !tracks) return;
    const host_user_id = session.user?.email || session.user?.name || "unknown";
    const user_name = session.user?.name || host_user_id;
    const res = await fetch("/api/game/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host_user_id,
        playlist_id: selectedPlaylist.id,
        tracks,
      }),
    });
    const data = await res.json();
    if (data.gameId) {
      router.push(`/game/${data.gameId}`);
    } else {
      alert(data.error || "Failed to create game");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <main className="flex flex-col gap-8 items-center w-full max-w-4xl">
        <div className="flex flex-col items-center gap-4 w-full">
          {!session ? (
            <button
              className="rounded-full bg-green-500 hover:bg-green-600 text-white px-6 py-2 font-semibold shadow"
              onClick={() => signIn("spotify")}
            >
              Log in with Spotify
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <span className="text-lg font-medium text-gray-900">Welcome, {session.user?.name || "Spotify User"}!</span>
              <button
                className="rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 font-semibold shadow mb-4"
                onClick={() => signOut()}
              >
                Log out
              </button>
              {/* Playlist section */}
              {!selectedPlaylist && (
                <div className="w-full max-w-md">
                  <h2 className="text-xl font-bold mb-2">Your Playlists</h2>
                  {loading && <div>Loading playlists...</div>}
                  {error && <div className="text-red-500">{error}</div>}
                  {playlists && (
                    <ul className="grid gap-3">
                      {playlists.map((playlist) => (
                        <li
                          key={playlist.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSelectPlaylist(playlist)}
                        >
                          {playlist.images[0] && (
                            <img src={playlist.images[0].url} alt={playlist.name} className="w-12 h-12 rounded" />
                          )}
                          <span className="font-medium text-gray-900">{playlist.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {/* End Playlist section */}

              {/* Game section */}
              {selectedPlaylist && tracks && bracket.length > 0 && !tournamentWinner && (
                <div className="w-full max-w-2xl mt-6 flex flex-col items-center gap-8">
                  <h2 className="text-xl font-bold mb-2">Round {currentRound + 1} - Matchup {currentMatchupIdx + 1} of {bracket[currentRound].length}</h2>
                  {bracket[currentRound][currentMatchupIdx].trackA.id !== bracket[currentRound][currentMatchupIdx].trackB.id ? (
                    <div className="flex flex-row gap-12 justify-center items-center">
                      {[bracket[currentRound][currentMatchupIdx].trackA, bracket[currentRound][currentMatchupIdx].trackB].map((track, idx) => (
                        <div key={track.id} className="flex flex-col items-center">
                          <iframe
                            src={`https://open.spotify.com/embed/track/${track.id}`}
                            width="500"
                            height="300"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            title={`Spotify player for ${track.id}`}
                          ></iframe>
                          <button
                            className="rounded bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 font-semibold shadow mt-2 w-full max-w-xs"
                            onClick={() => handleBracketVote(track)}
                          >
                            Vote
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <iframe
                        src={`https://open.spotify.com/embed/track/${bracket[currentRound][currentMatchupIdx].trackA.id}`}
                        width="500"
                        height="300"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={`Spotify player for ${bracket[currentRound][currentMatchupIdx].trackA.id}`}
                      ></iframe>
                      <div className="mt-4 text-lg font-semibold text-gray-900">Automatically advances to next round</div>
                      <button
                        className="rounded bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 font-semibold shadow mt-2 w-full max-w-xs"
                        onClick={() => handleBracketVote(bracket[currentRound][currentMatchupIdx].trackA)}
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              )}
              {tournamentWinner && (
                <div className="w-full max-w-2xl mt-6 flex flex-col items-center gap-8">
                  <h2 className="text-2xl font-bold mb-4">Winner!</h2>
                  <iframe
                    src={`https://open.spotify.com/embed/track/${tournamentWinner.id}`}
                    width="500"
                    height="300"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={`Spotify player for ${tournamentWinner.id}`}
                  ></iframe>
                  <div className="text-lg font-semibold text-gray-900 mt-4">{tournamentWinner.name} by {tournamentWinner.artists.map(a => a.name).join(", ")}</div>
                </div>
              )}
              {/* End Game section */}

              {selectedPlaylist && tracks && (
                <button
                  className="mt-6 rounded bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-bold shadow"
                  onClick={handleStartGame}
                >
                  Start Game
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}