import { createHash } from "node:crypto";
import type {
	LastFmErrorResponse,
	LastFmRecentTracksResponse,
	LastFmScrobblesResponse,
	ScrobbleInput,
} from "./types/lastfm.d.ts";

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const MAX_SCROBBLES_PER_REQUEST = 50;

type JsonObject = Record<string, unknown>;

export class LastFmApiError extends Error {
	readonly upstreamCode: number | undefined;
	readonly status: number | undefined;

	constructor(
		message: string,
		upstreamCode?: number,
		status?: number,
	) {
		super(message);
		this.name = "LastFmApiError";
		this.upstreamCode = upstreamCode;
		this.status = status;
	}
}

function requiredEnvironmentVariable(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLastFmError(value: unknown): value is LastFmErrorResponse {
	return (
		isJsonObject(value) &&
		typeof value.error === "number" &&
		typeof value.message === "string"
	);
}

function isScrobblesResponse(value: unknown): value is LastFmScrobblesResponse {
	if (!isJsonObject(value) || !isJsonObject(value.scrobbles)) {
		return false;
	}

	const attributes = value.scrobbles["@attr"];
	const scrobble = value.scrobbles.scrobble;
	return (
		isJsonObject(attributes) &&
		typeof attributes.accepted === "string" &&
		typeof attributes.ignored === "string" &&
		(Array.isArray(scrobble) || isJsonObject(scrobble))
	);
}

function isRecentTracksResponse(
	value: unknown,
): value is LastFmRecentTracksResponse {
	return isJsonObject(value) && isJsonObject(value.recenttracks);
}

function createApiSignature(
	parameters: URLSearchParams,
	sharedSecret: string,
): string {
	const signatureBase = [...parameters.entries()]
		.filter(
			([name]) =>
				name !== "api_sig" && name !== "callback" && name !== "format",
		)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([name, value]) => `${name}${value}`)
		.join("");

	return createHash("md5")
		.update(signatureBase + sharedSecret, "utf8")
		.digest("hex");
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new LastFmApiError(
			`Last.fm returned an invalid JSON response (${response.status})`,
			undefined,
			response.status,
		);
	}
}

function throwForLastFmError(payload: unknown, response: Response): void {
	if (isLastFmError(payload)) {
		throw new LastFmApiError(
			`Last.fm API error ${payload.error}: ${payload.message}`,
			payload.error,
			response.status,
		);
	}

	if (!response.ok) {
		throw new LastFmApiError(
			`Last.fm request failed (${response.status} ${response.statusText})`,
			undefined,
			response.status,
		);
	}
}

function validateScrobble(input: ScrobbleInput, index: number): void {
	if (!input.artist.trim()) {
		throw new TypeError(`scrobbles[${index}].artist must not be empty`);
	}
	if (!input.track.trim()) {
		throw new TypeError(`scrobbles[${index}].track must not be empty`);
	}
	if (!Number.isSafeInteger(input.timestamp) || input.timestamp < 0) {
		throw new TypeError(
			`scrobbles[${index}].timestamp must be a non-negative UNIX timestamp in seconds`,
		);
	}
	if (
		input.duration !== undefined &&
		(!Number.isSafeInteger(input.duration) || input.duration < 1)
	) {
		throw new TypeError(
			`scrobbles[${index}].duration must be a positive integer in seconds`,
		);
	}
	if (
		input.trackNumber !== undefined &&
		(!Number.isSafeInteger(input.trackNumber) || input.trackNumber < 1)
	) {
		throw new TypeError(
			`scrobbles[${index}].trackNumber must be a positive integer`,
		);
	}
}

function appendOptionalParameter(
	parameters: URLSearchParams,
	name: string,
	value: string | number | undefined,
): void {
	if (value !== undefined && value !== "") {
		parameters.set(name, String(value));
	}
}

export async function getRecentTracks(
	username: string,
): Promise<LastFmRecentTracksResponse> {
	if (!username.trim()) {
		throw new TypeError("username must not be empty");
	}

	const parameters = new URLSearchParams({
		method: "user.getRecentTracks",
		user: username,
		api_key: requiredEnvironmentVariable("LASTFM_API_KEY"),
		format: "json",
		page: "1",
		limit: "25",
		extended: "1",
	});
	const response = await fetch(`${API_URL}?${parameters}`);
	const payload = await readJson(response);
	throwForLastFmError(payload, response);

	if (!isRecentTracksResponse(payload)) {
		throw new LastFmApiError("Last.fm returned an unexpected recent tracks response");
	}
	return payload;
}

export async function scrobble(
	input: ScrobbleInput | readonly ScrobbleInput[],
	sessionKey = requiredEnvironmentVariable("LASTFM_SESSION_KEY"),
): Promise<LastFmScrobblesResponse> {
	const scrobbles = Array.isArray(input) ? input : [input];
	if (scrobbles.length < 1 || scrobbles.length > MAX_SCROBBLES_PER_REQUEST) {
		throw new RangeError(
			`scrobble accepts between 1 and ${MAX_SCROBBLES_PER_REQUEST} tracks`,
		);
	}
	if (!sessionKey) {
		throw new Error("LASTFM_SESSION_KEY is not set");
	}

	const parameters = new URLSearchParams({
		api_key: requiredEnvironmentVariable("LASTFM_API_KEY"),
		method: "track.scrobble",
		sk: sessionKey,
	});

	for (const [index, item] of scrobbles.entries()) {
		validateScrobble(item, index);
		parameters.set(`artist[${index}]`, item.artist);
		parameters.set(`track[${index}]`, item.track);
		parameters.set(`timestamp[${index}]`, String(item.timestamp));
		appendOptionalParameter(parameters, `album[${index}]`, item.album);
		appendOptionalParameter(
			parameters,
			`albumArtist[${index}]`,
			item.albumArtist,
		);
		appendOptionalParameter(parameters, `mbid[${index}]`, item.mbid);
		appendOptionalParameter(parameters, `duration[${index}]`, item.duration);
		appendOptionalParameter(
			parameters,
			`trackNumber[${index}]`,
			item.trackNumber,
		);
		if (item.chosenByUser !== undefined) {
			parameters.set(`chosenByUser[${index}]`, item.chosenByUser ? "1" : "0");
		}
	}

	parameters.set(
		"api_sig",
		createApiSignature(
			parameters,
			requiredEnvironmentVariable("LASTFM_SHARED_SECRET"),
		),
	);
	// Last.fm explicitly excludes format from the signature.
	parameters.set("format", "json");

	const response = await fetch(API_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: parameters,
	});
	const payload = await readJson(response);
	throwForLastFmError(payload, response);

	if (!isScrobblesResponse(payload)) {
		throw new LastFmApiError("Last.fm returned an unexpected scrobble response");
	}
	return payload;
}
