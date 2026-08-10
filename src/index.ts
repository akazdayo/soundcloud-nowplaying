import { getNewTracks } from "./getNewTracks.ts";
import { getHistories } from "./soundcloud.ts";

const KV_KEY = "lastPlayedAt";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response("Hello World!");
	},

	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
    console.log("hi");
		const storedLastPlayedAt = await env.lastPlayed.get(KV_KEY);
    console.log(storedLastPlayedAt);
		const lastPlayedAt =
			storedLastPlayedAt === null ? -1 : Number(storedLastPlayedAt);
		const history = await getHistories();
		const newestPlayedAt = history.collection[0]?.played_at;

		if (newestPlayedAt !== undefined && newestPlayedAt !== lastPlayedAt) {
			await getNewTracks(history, lastPlayedAt);
			await env.lastPlayed.put(KV_KEY, String(newestPlayedAt));
		}
	},
} satisfies ExportedHandler<Env>;
