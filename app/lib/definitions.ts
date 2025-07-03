// Shared types for minimal Spotify track and bracket

export interface Playlist {
  id: string;
  name: string;
  images: { url: string }[];
}

export interface Track {
  id: string;
  name: string;
  artists: string[];
  album: {
    name: string;
    image: string;
  };
  duration_ms?: number;
  preview_url?: string | null;
}

export interface BracketMatchup {
  trackA: Track;
  trackB: Track;
  winner?: Track;
} 