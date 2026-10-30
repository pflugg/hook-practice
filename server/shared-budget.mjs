const script = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local burst = tonumber(redis.call('GET', KEYS[2]) or '0')
if not used or not burst or used < 0 or burst < 0 then return redis.error_reply('Invalid quota') end
if used >= tonumber(ARGV[1]) or burst >= 20 then return 0 end
redis.call('INCR', KEYS[1])
local current = redis.call('INCR', KEYS[2])
if current == 1 then redis.call('EXPIRE', KEYS[2], 120) end
return 1
`;

/** A shared atomic quota survives serverless cold starts and redeploys. No expiry on total usage. */
export function createSharedReservation(options = {}) {
  const url = options.url ?? process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = options.token ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  const key = options.key ?? "neverland-duel:luna:v1";
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  return async (limit) => {
    if (!url || !token || !/^https:\/\/[^/]+\.upstash\.io\/?$/.test(url)) throw new Error("Shared quota is not configured");
    const response = await fetchImpl(url, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", script, "2", `${key}:total`, `${key}:minute:${Math.floor(now() / 60000)}`, String(limit)]),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("Shared quota unavailable");
    const data = await response.json();
    if (data.error || ![0, 1].includes(data.result)) throw new Error("Shared quota invalid");
    return data.result === 1;
  };
}
