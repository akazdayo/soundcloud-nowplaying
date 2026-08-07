import createClient from "openapi-fetch";
import type { paths } from "./types/soundcloud.d.ts";

const client = createClient<paths>({ baseUrl: "https://api-v2.soundcloud.com" });
const OAUTH_TOKEN = process.env.SOUNDCLOUD_OAUTH_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

export const getHistories = async () => {
  const { data, error } = await client.GET(
    "/me/play-history/tracks",
    {
      params: {
        query: {
          client_id: CLIENT_ID!,
          limit: 25,
          oauth_token: OAUTH_TOKEN,
        },
      },
    },
  );
  if (error !== undefined) {
    throw `get history error, ${error}`;
  }
  return data;
};
