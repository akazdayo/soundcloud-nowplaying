export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response("Hello World!");
	},

	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		console.log("cron processed");
	},
} satisfies ExportedHandler<Env>;
