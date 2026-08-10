import createClient from "openapi-fetch";
import type { paths } from "./types/soundcloud.d.ts";

const client = createClient<paths>({ baseUrl: "https://api-v2.soundcloud.com" });
const OAUTH_TOKEN = process.env.SOUNDCLOUD_OAUTH_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;

export type HistoriesResponse = paths["/me/play-history/tracks"]["get"]["responses"][200]["content"]["application/json"];

export const getHistories = async () => {
  const { data, error } = await client.GET(
    "/me/play-history/tracks",
    {
      params: {
        query: {
          client_id: CLIENT_ID,
          limit: 25,
          oauth_token: OAUTH_TOKEN,
        },
      },
    },
  );
  if (error !== undefined || data === undefined) {
    throw new Error(`get history error: ${error}`);
  }
  return data;
};

export const getTrack = async (trackId: number) => {
  const { data, error, response } = await client.GET("/tracks", {
    params: {
      query: {
        ids: String(trackId),
        client_id: CLIENT_ID,
        app_version: "1785928841",
        app_locale: "en",
      },
      header: {
        Authorization: `OAuth ${OAUTH_TOKEN}`,
      },
    },
  });

  if (!response.ok || error !== undefined) {
    throw new Error(
      `get track error: ${response.status} ${response.statusText} ${JSON.stringify(error)}`,
    );
  }

  const track = data?.[0];
  if (track === undefined) {
    throw new Error(`get track error: track ${trackId} was not returned`);
  }

  return track;
};
