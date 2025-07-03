"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Track, Playlist } from "@/app/lib/definitions";



export default function HostCreatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);

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
    if (session) fetchPlaylists();
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
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    if (selectedPlaylist) fetchTracks();
  }, [selectedPlaylist, session]);

  // Handler for starting a game
  const handleStartGame = async () => {
    if (!session || !selectedPlaylist || !tracks) return;
    const host_user_id = session.user?.email || session.user?.name || "unknown";
    setLoading(true);
    setError(null);
    try {
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
      if (data.code) {
        router.push(`/host/${data.code}`);
      } else {
        setError(data.error || "Failed to create game");
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <button
          className="rounded bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-bold "
          onClick={() => signIn("spotify")}
        >
          Log in with Spotify
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <main className="flex flex-col gap-8 items-center w-full max-w-4xl">
        <div className="flex flex-col items-center gap-6 w-full max-w-md bg-white p-8 rounded ">
          <h2 className="text-xl font-bold mb-4">Create a Game</h2>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          {loading && <div>Loading...</div>}
          {!playlists && !loading && <div>No playlists found.</div>}
          {playlists && (
            <ul className="grid gap-3 w-full">
              {playlists.map((playlist) => (
                <li
                  key={playlist.id}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer ${selectedPlaylist?.id === playlist.id ? "bg-blue-100" : "hover:bg-gray-100"}`}
                  onClick={() => setSelectedPlaylist(playlist)}
                >
                  {playlist.images[0] && (
                    <img src={playlist.images[0].url} alt={playlist.name} className="w-12 h-12 rounded" />
                  )}
                  <span className="font-medium text-gray-900">{playlist.name}</span>
                </li>
              ))}
            </ul>
          )}
          {selectedPlaylist && tracks && (
            <button
              className="mt-6 rounded bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-bold  w-full"
              onClick={handleStartGame}
              disabled={loading}
            >
              Start Game
            </button>
          )}
        </div>
      </main>
    </div>
  );
} 