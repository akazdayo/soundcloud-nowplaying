import { getNewTracks } from "./getNewTracks.ts";
import { getHistories } from "./soundcloud.ts";

let lastPlayedAt = -1;
while (true) {
  const history = await getHistories();
  const newestPlayedAt = history.collection[0]?.played_at;

  if (newestPlayedAt !== undefined && newestPlayedAt !== lastPlayedAt) {
    await getNewTracks(history, lastPlayedAt);
    lastPlayedAt = newestPlayedAt;
  }

  const second = 1000;
  await new Promise((resolve) => {
    setTimeout(resolve, 10 * second);
  });
}
