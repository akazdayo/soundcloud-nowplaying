import { getHistories } from "./soundcloud.ts";
import type { HistoriesResponse } from "./soundcloud.ts";

export const getNewTracks = (data: HistoriesResponse, lastPlayedAt: number) => {
  const newTracks = [];
  for (const [i, item] of (data.collection ?? []).entries()) {
    const playedAt = item.played_at;
    if (playedAt > lastPlayedAt) {
      console.log(`${i} New track!: ${item.track.id}`);
      newTracks.push(item.track.id);
    } else {
      break;
    }
  }
  return newTracks;
};

let lastPlayedAt = -1;
while (true) {
  const history = await getHistories();
  const newestPlayedAt = history.collection[0]?.played_at;

  if (newestPlayedAt !== undefined && newestPlayedAt !== lastPlayedAt) {
    const newTracks = getNewTracks(history, lastPlayedAt);
    lastPlayedAt = newestPlayedAt;
  }

  const second = 1000;
  await new Promise((resolve) => {
    setTimeout(resolve, 60 * second);
  });
}
