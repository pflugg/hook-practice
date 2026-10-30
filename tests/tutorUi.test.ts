/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installTutor } from "../src/ui/tutor";
import type { TutorContext } from "../src/engine/tutor";

const context: TutorContext = { position: "position-1", facts: [
  { id: "next", title: "Next", text: "Move to Skull Rock." },
  { id: "reason", title: "Why", text: "Move before using actions." },
] };
function boot(getContext = () => context) {
  document.body.innerHTML = '<main id="game"><button data-tutor-open>Ask Coach</button></main>';
  const root = document.querySelector<HTMLElement>("main")!;
  installTutor(root, getContext);
  const opener = root.querySelector<HTMLButtonElement>("button")!;
  opener.focus(); opener.click();
  return { root, opener, ask: () => document.querySelector<HTMLButtonElement>("[data-luna-question]")!.click() };
}
const reply = (overrides = {}) => new Response(JSON.stringify({ source: "luna", position: context.position, answerable: true, factIds: ["reason"], ...overrides }));
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

describe("optional grounded tutor dialog", () => {
  it("sends nothing on open, traps focus, and restores the game on Escape", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { root, opener } = boot();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(root.hasAttribute("inert")).toBe(true);
    const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
    expect(panel.getAttribute("aria-labelledby")).toBe("luna-title");
    const first = panel.querySelector<HTMLButtonElement>("button")!;
    const last = panel.querySelector<HTMLButtonElement>("[data-luna-close]")!;
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".luna-overlay")).toBeNull();
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("shows the selected engine fact and caches the same question and position", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => reply()); vi.stubGlobal("fetch", fetchMock);
    const { ask } = boot(); ask();
    await vi.waitFor(() => expect(document.querySelector(".luna-source")?.textContent).toContain("Selected by Luna"));
    expect(document.querySelector(".luna-answer")?.textContent).toContain("Move before using actions.");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).context).toEqual(context);
    ask(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { factIds: ["invented"], answer: "SECRET OR FABRICATED RULE" },
    { source: "local", reason: "ai_unavailable" },
    { position: "old-position" },
  ])("falls back safely for an invalid or unavailable answer %#", async (value) => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(value)));
    boot().ask();
    await vi.waitFor(() => expect(document.querySelector(".luna-source")?.textContent).toContain("Local Coach"));
    expect(document.body.textContent).toContain("Move before using actions.");
    expect(document.body.textContent).not.toContain("SECRET OR FABRICATED RULE");
  });

  it("declines an unsupported question without inventing an answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ answerable: false, factIds: [] })));
    boot().ask();
    await vi.waitFor(() => expect(document.querySelector(".luna-answer")?.textContent).toContain("beyond the facts"));
  });

  it("discards a reply if the position changed while waiting", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    let current = context;
    boot(() => current).ask();
    current = { ...context, position: "position-2" };
    finish(reply());
    await vi.waitFor(() => expect(document.querySelector(".luna-answer")?.textContent).toContain("position changed"));
    expect(document.querySelector(".luna-source")).toBeNull();
  });

  it("aborts the in-flight browser request when the dialog closes", () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => { signal = init.signal ?? undefined; return new Promise<Response>(() => undefined); }));
    boot().ask();
    document.querySelector<HTMLButtonElement>("[data-luna-close]")!.click();
    expect(signal?.aborted).toBe(true);
    expect(document.querySelector(".luna-overlay")).toBeNull();
  });
});
