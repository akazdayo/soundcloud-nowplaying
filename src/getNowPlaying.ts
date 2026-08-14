import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getHistories } from "./soundcloud.ts";
import type { HistoriesResponse } from "./soundcloud.ts";

const DEFAULT_POLL_INTERVAL_MS = 10_000;

type HistoryItem = HistoriesResponse["collection"][number];

export type PlaybackStatus = "now-playing" | "played" | "unknown";

export interface PlaybackEstimate {
	status: PlaybackStatus;
	item: HistoryItem;
	playedAt: number;
	elapsedMs: number;
	durationMs?: number;
	expectedEndedAt?: number;
}

function positiveDuration(...candidates: Array<number | undefined>): number | undefined {
	return candidates.find(
		(value): value is number =>
			value !== undefined && Number.isFinite(value) && value > 0,
	);
}

function newestHistoryItem(history: HistoriesResponse): HistoryItem | undefined {
	return history.collection.reduce<HistoryItem | undefined>((newest, item) => {
		if (newest === undefined || item.played_at > newest.played_at) {
			return item;
		}
		return newest;
	}, undefined);
}

/**
 * SoundCloud の再生履歴にある開始時刻と曲長から、最新曲の再生状態を推定する。
 * 一時停止、シーク、再生速度は履歴から取得できないため考慮しない。
 */
export function estimateNowPlaying(
	history: HistoriesResponse,
	nowMs = Date.now(),
): PlaybackEstimate | undefined {
	const item = newestHistoryItem(history);
	if (item === undefined) {
		return undefined;
	}

	const playedAt = item.played_at;
	const elapsedMs = Math.max(0, nowMs - playedAt);
	const durationMs = positiveDuration(
		item.track.duration,
		item.track.full_duration,
	);

	if (
		!Number.isFinite(playedAt) ||
		!Number.isFinite(nowMs) ||
		nowMs < playedAt ||
		durationMs === undefined
	) {
		return {
			status: "unknown",
			item,
			playedAt,
			elapsedMs,
		};
	}

	const expectedEndedAt = playedAt + durationMs;
	return {
		status: nowMs < expectedEndedAt ? "now-playing" : "played",
		item,
		playedAt,
		elapsedMs,
		durationMs,
		expectedEndedAt,
	};
}

export async function getNowPlaying(
	nowMs = Date.now(),
): Promise<PlaybackEstimate | undefined> {
	return estimateNowPlaying(await getHistories(), nowMs);
}

function formatTime(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function logEstimate(estimate: PlaybackEstimate | undefined): void {
	if (estimate === undefined) {
		console.log("SoundCloud history is empty");
		return;
	}

	const title = estimate.item.track.title ?? `track:${estimate.item.track_id}`;
	if (
		estimate.status === "now-playing" &&
		estimate.durationMs !== undefined
	) {
		console.log(
			`Now playing: ${title} (${formatTime(estimate.elapsedMs)} / ${formatTime(estimate.durationMs)})`,
		);
		return;
	}

	if (estimate.status === "played") {
		console.log(`Played: ${title}`);
		return;
	}

	console.log(`Playback status unknown: ${title}`);
}

function estimateKey(estimate: PlaybackEstimate | undefined): string {
	if (estimate === undefined) {
		return "empty";
	}
	return `${estimate.item.track_id}:${estimate.playedAt}:${estimate.status}`;
}

export async function watchNowPlaying(
	pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): Promise<never> {
	if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
		throw new RangeError("pollIntervalMs must be a positive number");
	}

	let lastEstimateKey: string | undefined;
	while (true) {
		try {
			const estimate = await getNowPlaying();
			const key = estimateKey(estimate);
			if (key !== lastEstimateKey) {
				logEstimate(estimate);
				lastEstimateKey = key;
			}
		} catch (error) {
			console.error(
				JSON.stringify({
					message: "Failed to estimate SoundCloud playback status",
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		}

		await new Promise<void>((resolveDelay) => {
			setTimeout(resolveDelay, pollIntervalMs);
		});
	}
}

const entryPoint = process.argv[1];
if (
	entryPoint !== undefined &&
	fileURLToPath(import.meta.url) === resolve(entryPoint)
) {
	await watchNowPlaying();
}
