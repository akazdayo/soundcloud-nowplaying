import { createHash } from "node:crypto";

type LastFmSession = {
  session: {
    name: string;
    key: string;
    subscriber: number;
  };
};

type LastFmError = { error: number; message: string };

const API_URL = "https://ws.audioscrobbler.com/2.0/";

export async function exchangeTokenForSession(token: string) {
  const apiKey = process.env.LASTFM_API_KEY;
  const apiSecret = process.env.LASTFM_SHARED_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Last.fm環境変数がありません");

  // api_sigにはformatを含めない。名前順に連結し、最後にsecretを付けてMD5化する。
  const signatureBase =
    `api_key${apiKey}` + `methodauth.getSession` + `token${token}` + apiSecret;
  const apiSig = createHash("md5").update(signatureBase, "utf8").digest("hex");

  const body = new URLSearchParams({
    method: "auth.getSession",
    api_key: apiKey,
    token,
    api_sig: apiSig,
    format: "json",
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json()) as LastFmSession | LastFmError;

  if (!response.ok || "error" in result) {
    const message = "error" in result ? `${result.error}: ${result.message}` : response.statusText;
    throw new Error(`Last.fm認証に失敗しました: ${message}`);
  }

  // result.session.keyをDB等へ暗号化して保存する。
  return result.session;
}

const session = await exchangeTokenForSession(TOKEN);
console.log(session.key); // Scrobble時のSession Key
