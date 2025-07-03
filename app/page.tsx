"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length > 0) {
      router.push(`/join/${code.trim().toUpperCase()}`);
    }
  };

  const handleCreate = () => {
    router.push("/host/create");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <main className="flex flex-col gap-8 items-center w-full max-w-4xl">
        <div className="flex flex-col items-center gap-6 w-full max-w-md bg-white p-8 rounded ">
          <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full">
            <label htmlFor="game-code" className="text-lg font-semibold">Join a Game</label>
            <input
              id="game-code"
              type="text"
              maxLength={5}
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
              className="border rounded px-4 py-2 text-lg text-center tracking-widest uppercase"
              placeholder="Enter Game Code"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-bold "
              disabled={code.trim().length === 0}
            >
              Join Game
            </button>
          </form>
          <div className="w-full border-t my-4" />
          <button
            className="rounded bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-bold  w-full"
            onClick={handleCreate}
          >
            Create New Game
          </button>
        </div>
      </main>
    </div>
  );
}