"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

export default function JoinGamePage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }
    // Save username (with emoji support) in localStorage
    localStorage.setItem("songmash_username", username.trim());
    router.push(`/game/${code}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-md bg-white p-8 rounded shadow">
        <h2 className="text-xl font-bold mb-2 text-center">Enter your name to join</h2>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="border rounded px-4 py-2 text-lg text-center"
          placeholder="Your name (emojis allowed!)"
          maxLength={24}
          autoFocus
        />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          className="rounded bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-bold mt-2"
          disabled={!username.trim()}
        >
          Join Game
        </button>
      </form>
    </div>
  );
} 