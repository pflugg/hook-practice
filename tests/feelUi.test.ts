/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { mount, renderPlay } from "../src/ui/app";
import { barePlayState } from "./helpers";

describe("feel and the sound control", () => {
  it("thickens the rival warning and keeps a sound toggle on the voyage bar", () => {
    const far = barePlayState();
    far.coachOn = false;
    far.rivalProgress = 10;
    const farHtml = renderPlay(far, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(farHtml).toContain("data-rival-meter");
    expect(farHtml).not.toContain("is-close");
    expect(farHtml).toContain("data-sound-toggle");
    expect(farHtml).toContain(">Sound on<");

    const near = barePlayState();
    near.coachOn = false;
    near.difficulty = "normal";
    near.rivalProgress = 130;
    const nearHtml = renderPlay(near, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(nearHtml).toContain("is-close");
    expect(nearHtml).toContain("130 / 154");
  });

  it("marks a win and a rival loss before the recap headline", () => {
    const won = barePlayState();
    won.phase = "over";
    won.won = true;
    const winHtml = renderPlay(won, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(winHtml).toContain('data-outcome');
    expect(winHtml).toContain(">Victory<");
    expect(winHtml.indexOf("data-outcome")).toBeLessThan(winHtml.indexOf('id="recap-title"'));

    const lost = barePlayState();
    lost.phase = "over";
    lost.lost = true;
    lost.won = false;
    const lossHtml = renderPlay(lost, { coachEnabled: false, briefEnabled: false, reasonsEnabled: false });
    expect(lossHtml).toContain(">Defeat<");
    expect(lossHtml).toContain("Voyage recap");
  });

  it("puts a remembered mute control on the title", () => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    const root = document.createElement("div");
    document.body.appendChild(root);
    window.scrollTo = (() => undefined) as typeof window.scrollTo;
    mount(root);
    const btn = root.querySelector<HTMLButtonElement>("[data-sound-toggle]");
    expect(btn?.textContent).toBe("Sound on");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    btn!.click();
    const off = root.querySelector<HTMLButtonElement>("[data-sound-toggle]");
    expect(off?.textContent).toBe("Sound off");
    expect(off?.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem("nld-sound")).toBe("0");
    root.remove();
    localStorage.clear();
  });
});
