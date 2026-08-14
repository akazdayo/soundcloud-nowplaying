import { describe, expect, it } from "vitest";
import {
	estimateNowPlaying,
	type PlaybackStatus,
} from "../src/getNowPlaying.ts";
import type { HistoriesResponse } from "../src/soundcloud.ts";

const PLAYED_AT = 1_700_000_000_000;

function history(
	duration: number | undefined,
	options: {
		fullDuration?: number;
		playedAt?: number;
	} = {},
): HistoriesResponse {
	const track: HistoriesResponse["collection"][number]["track"] = {
		id: 123,
		title: "Test track",
	};
	if (duration !== undefined) {
		track.duration = duration;
	}
	if (options.fullDuration !== undefined) {
		track.full_duration = options.fullDuration;
	}

	return {
		collection: [
			{
				played_at: options.playedAt ?? PLAYED_AT,
				track_id: 123,
				track,
			},
		],
		next_href: null,
		query_urn: null,
	};
}

function statusAt(
	data: HistoriesResponse,
	nowMs: number,
): PlaybackStatus | undefined {
	return estimateNowPlaying(data, nowMs)?.status;
}

describe("estimateNowPlaying", () => {
	it("returns undefined for empty history", () => {
		expect(
			estimateNowPlaying({
				collection: [],
				next_href: null,
				query_urn: null,
			}),
		).toBeUndefined();
	});

	it("treats a track as now playing until its duration has elapsed", () => {
		const data = history(180_000);

		expect(statusAt(data, PLAYED_AT)).toBe("now-playing");
		expect(statusAt(data, PLAYED_AT + 179_999)).toBe("now-playing");
	});

	it("treats a track as played at the expected end timestamp", () => {
		expect(statusAt(history(180_000), PLAYED_AT + 180_000)).toBe(
			"played",
		);
	});

	it("uses duration before full_duration", () => {
		const data = history(30_000, { fullDuration: 180_000 });

		expect(statusAt(data, PLAYED_AT + 30_000)).toBe("played");
	});

	it("falls back to full_duration", () => {
		const data = history(undefined, { fullDuration: 180_000 });

		expect(statusAt(data, PLAYED_AT + 179_999)).toBe("now-playing");
	});

	it("returns unknown when duration is unavailable", () => {
		expect(statusAt(history(undefined), PLAYED_AT)).toBe("unknown");
	});

	it("returns unknown for a future playback timestamp", () => {
		expect(statusAt(history(180_000), PLAYED_AT - 1)).toBe("unknown");
	});

	it("selects the newest item even if the response is not sorted", () => {
		const data = history(180_000);
		data.collection.unshift({
			played_at: PLAYED_AT - 1_000_000,
			track_id: 456,
			track: { id: 456, title: "Old track", duration: 1_000 },
		});

		expect(estimateNowPlaying(data, PLAYED_AT)?.item.track_id).toBe(123);
	});
});
