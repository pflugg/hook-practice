import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createTutorHandler, createTutorService } from "../server/tutor.mjs";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createSharedReservation } from "../server/shared-budget.mjs";

const folders: string[] = [];
function budget() { const folder = mkdtempSync(path.join(os.tmpdir(), "nld-tutor-test-")); folders.push(folder); return path.join(folder, "budget.json"); }
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
const request = (question = "Why move?") => ({ question, context: { position: "test-position", facts: [{ id: "next", title: "Next", text: "Move to Skull Rock." }, { id: "reason", title: "Why", text: "Move before using actions." }] } });
const completed = (selection: unknown) => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(selection) }] }] }));
const good = () => completed({ answerable: true, factIds: ["reason"] });

describe("optional Luna server", () => {
  it("pins Luna, disables storage and reasoning, and never puts the API key in the prompt or answer", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const payload = JSON.parse(String(options?.body));
      expect(payload.model).toBe("gpt-6-luna");
      expect(payload.store).toBe(false);
      expect(payload.reasoning.effort).toBe("none");
      expect(payload.max_output_tokens).toBe(256);
      expect(String(options?.body)).not.toContain("unit-test-credential");
      return good();
    });
    const result = await createTutorService({ apiKey: "unit-test-credential", budgetPath: budget(), fetchImpl }).select(request());
    expect(result.status).toBe(200);
    expect(result.body.factIds).toEqual(["reason"]);
    expect(JSON.stringify(result)).not.toContain("unit-test-credential");
  });

  it.each([
    { answerable: true, factIds: ["made-up"] },
    { answerable: true, factIds: ["reason"], answer: "Win off the ship" },
    { answerable: true, factIds: [] },
    { answerable: true, factIds: ["next", "next"] },
    { answerable: false, factIds: ["next"] },
  ])("rejects unsupported model output %#", async (selection) => {
    const result = await createTutorService({ apiKey: "test", budgetPath: budget(), fetchImpl: vi.fn(async () => completed(selection)) }).select(request());
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ source: "local", reason: "invalid_answer" });
  });

  it("caches an answer and enforces a persistent quota across service instances", async () => {
    const file = budget();
    const fetchImpl = vi.fn(async () => good());
    const service = createTutorService({ apiKey: "test", budgetPath: file, maxRequests: 1, fetchImpl });
    expect((await service.select(request())).status).toBe(200);
    expect((await service.select(request())).body.cached).toBe(true);
    const next = createTutorService({ apiKey: "test", budgetPath: file, maxRequests: 1, fetchImpl });
    expect((await next.select(request("Another question"))).body.reason).toBe("budget_exhausted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed for a corrupt quota ledger or an unavailable shared quota", async () => {
    const file = budget();
    writeFileSync(file, "corrupt");
    const fetchImpl = vi.fn(async () => good());
    expect((await createTutorService({ apiKey: "test", budgetPath: file, fetchImpl }).select(request())).body.reason).toBe("budget_unavailable");
    expect((await createTutorService({ apiKey: "test", fetchImpl, reserveRequest: async () => { throw new Error("offline"); } }).select(request())).body.reason).toBe("budget_unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not leak upstream credential errors and does not retry a failed billed request", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "unit-test-credential" } }), { status: 401 }));
    const result = await createTutorService({ apiKey: "unit-test-credential", budgetPath: budget(), fetchImpl }).select(request());
    expect(result.body.reason).toBe("ai_unavailable");
    expect(JSON.stringify(result)).not.toContain("unit-test-credential");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid and oversized input before calling OpenAI", async () => {
    const fetchImpl = vi.fn(async () => good());
    const service = createTutorService({ apiKey: "test", budgetPath: budget(), fetchImpl });
    expect((await service.select({ ...request(), model: "expensive-model" })).status).toBe(400);
    expect((await service.select(request("x".repeat(241)))).status).toBe(400);
    const huge = { question: "Why?", context: { position: "test", facts: Array.from({ length: 64 }, (_, n) => ({ id: `fact-${n}`, title: "Fact", text: "x".repeat(2400) })) } };
    expect((await service.select(huge)).status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("limits uncached requests per client", async () => {
    const fetchImpl = vi.fn(async () => good());
    const service = createTutorService({ apiKey: "test", budgetPath: budget(), fetchImpl });
    for (let n = 0; n < 6; n++) expect((await service.select(request(`Question ${n}`))).status).toBe(200);
    expect((await service.select(request("Question 7"))).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});

describe("Vercel's shared quota", () => {
  it("uses a single atomic operation and a nonexpiring total across cold starts", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body));
      expect(command[0]).toBe("EVAL");
      expect(command[1]).toContain("redis.call('INCR', KEYS[1])");
      expect(command[1]).not.toContain("EXPIRE', KEYS[1]");
      expect(command[3]).toBe("neverland-duel:luna:v1:total");
      expect(command.at(-1)).toBe("200");
      return new Response('{"result":1}');
    });
    const reserve = createSharedReservation({ url: "https://test.upstash.io", token: "redis-test-token", fetchImpl });
    expect(await reserve(200)).toBe(true);
  });

  it("fails closed without Redis credentials or when the Redis response is invalid", async () => {
    await expect(createSharedReservation({ url: "", token: "" })(200)).rejects.toThrow();
    const reserve = createSharedReservation({ url: "https://test.upstash.io", token: "test", fetchImpl: vi.fn(async () => new Response('{"result":"wrong"}')) });
    await expect(reserve(200)).rejects.toThrow();
  });
});

describe("tutor HTTP boundary", () => {
  async function handle(options: { method?: string; origin?: string; contentType?: string; parsed?: unknown; raw?: string } = {}) {
    const input = Object.assign(Readable.from([options.raw ?? JSON.stringify(request())]), {
      method: options.method ?? "POST", headers: { host: "game.example", origin: options.origin ?? "https://game.example", "content-type": options.contentType ?? "application/json" },
      socket: { remoteAddress: "127.0.0.1" }, ...(options.parsed === undefined ? {} : { body: options.parsed }),
    });
    let status = 0; let body = "";
    const response = { writeHead(code: number) { status = code; return this; }, end(value: string) { body = value; } };
    const fetchImpl = vi.fn(async () => good());
    await createTutorHandler({ apiKey: "test", budgetPath: budget(), fetchImpl })(input as unknown as IncomingMessage, response as unknown as ServerResponse);
    return { status, body: JSON.parse(body), fetchImpl };
  }

  it("handles both a Vite stream and Vercel's pre-parsed JSON body", async () => {
    expect((await handle()).body.source).toBe("luna");
    expect((await handle({ parsed: request(), raw: "" })).body.source).toBe("luna");
  });

  it.each([
    [{ method: "GET" }, 405],
    [{ origin: "https://other.example" }, 403],
    [{ contentType: "text/plain" }, 415],
    [{ raw: "{invalid" }, 400],
    [{ raw: "x".repeat(24001) }, 413],
    [{ parsed: { huge: "x".repeat(24001) } }, 413],
  ] as const)("rejects disallowed HTTP input %# before calling OpenAI", async (options, status) => {
    const result = await handle(options);
    expect(result.status).toBe(status);
    expect(result.fetchImpl).not.toHaveBeenCalled();
  });
});
