import { getTrack } from "./soundcloud.ts";
import type { HistoriesResponse } from "./soundcloud.ts";

export const getNewTracks = async (
	data: HistoriesResponse,
	lastPlayedAt: number,
) => {
	const newTracks = [];
	for (const [i, item] of (data.collection ?? []).entries()) {
		const playedAt = item.played_at;
		if (playedAt > lastPlayedAt) {
			const trackMeta = await getTrack(item.track.id!);
			console.log(`${i} New track!: ${trackMeta.title}`);
			newTracks.push(item.track.id);
		} else {
			break;
		}
	}
	return newTracks;
};
