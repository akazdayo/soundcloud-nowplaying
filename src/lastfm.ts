import createClient from "openapi-fetch";
import type { paths } from "./types/lastfm.d.ts";

const client = createClient<paths>({ baseUrl: "https://ws.audioscrobbler.com/2.0/",   headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  }});

const apiKey = process.env.LASTFM_API_KEY!;
const sk = process.env.LASTFM_SESSION_KEY!;

export async function getRecentTracks(username: string) {
  const { data, error, response } = await client.GET(
    "/users/{username}/recent-tracks",
    {
      params: {
        path: { username },
        query: { page: 1, limit: 25, extended: true },
      },
    },
  );

  if (error) {
    throw new Error(`履歴の取得に失敗しました (${response.status}): ${JSON.stringify(error)}`);
  }

  return data; // RecentTracksResponse として型推論される
}

export async function scrobble(sessionKey: string) {
  const { data, error, response } = await client.POST("/scrobbles", {
    headers: {
      "X-Lastfm-Session-Key": sessionKey,
    },
    body: {
      scrobbles: [
        {
          artist: "ZUTOMAYO",
          track: "Study Me",
          album: "Gusare",
          timestamp: Math.floor(Date.now() / 1000),
          duration: 242,
          chosenByUser: true,
        },
      ],
    },
  });

  if (error) {
    throw new Error(`Scrobbleに失敗しました (${response.status}): ${JSON.stringify(error)}`);
  }

  return data; // CreateScrobblesResponse として型推論される
}
