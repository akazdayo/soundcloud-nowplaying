import { scrobble } from "./lastfm.ts";
import { getHistories } from "./soundcloud.ts";
import type { HistoriesResponse } from "./soundcloud.ts";
import type { ScrobbleInput } from "./types/lastfm.d.ts";

const KV_KEY = "lastPlayedAt";

type HistoryItem = HistoriesResponse["collection"][number];

function nonEmpty(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function toScrobbleInput(item: HistoryItem): ScrobbleInput | undefined {
	const track = item.track;
	const artist =
		nonEmpty(track.publisher_metadata?.artist) ??
		nonEmpty(track.user?.username) ??
		nonEmpty(track.user?.full_name);
	const title = nonEmpty(track.title);

	if (artist === undefined || title === undefined) {
		console.warn(
			JSON.stringify({
				message: "SoundCloud track is missing Last.fm metadata",
				trackId: track.id,
				playedAt: item.played_at,
			}),
		);
		return undefined;
	}

	const input: ScrobbleInput = {
		artist,
		track: title,
		timestamp: Math.floor(item.played_at / 1000),
	};
	const album =
		nonEmpty(track.publisher_metadata?.album_title) ??
		nonEmpty(track.publisher_metadata?.release_title);
	if (album !== undefined) {
		input.album = album;
	}

	const durationMs = track.full_duration ?? track.duration;
	if (
		durationMs !== undefined &&
		Number.isFinite(durationMs) &&
		durationMs > 0
	) {
		input.duration = Math.max(1, Math.round(durationMs / 1000));
	}

	return input;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response("Hello World!");
	},

	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		const storedLastPlayedAt = await env.lastPlayed.get(KV_KEY);
		const lastPlayedAt =
			storedLastPlayedAt === null ? -1 : Number(storedLastPlayedAt);
		if (!Number.isFinite(lastPlayedAt)) {
			throw new Error(`Invalid ${KV_KEY} value in KV`);
		}

		const history = await getHistories();
		const newestPlayedAt = history.collection[0]?.played_at;

		if (newestPlayedAt === undefined || newestPlayedAt <= lastPlayedAt) {
			return;
		}

		const pendingItems = history.collection.filter(
			(item) => item.played_at > lastPlayedAt,
		);
		const scrobbles = pendingItems
			.map(toScrobbleInput)
			.filter((input): input is ScrobbleInput => input !== undefined);

		if (scrobbles.length > 0) {
			const result = await scrobble(scrobbles);
			console.log(
				JSON.stringify({
					message: "SoundCloud tracks submitted to Last.fm",
					accepted: Number(result.scrobbles["@attr"].accepted),
					ignored: Number(result.scrobbles["@attr"].ignored),
				}),
			);
		}

		await env.lastPlayed.put(KV_KEY, String(newestPlayedAt));
	},
} satisfies ExportedHandler<Env>;
