import { checkedTutorSelection, TUTOR_QUESTIONS, type TutorContext, type TutorSelection } from "../engine/tutor";

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

/** An explanation overlay, with no access to the reducer or any move-dispatch function. */
export function installTutor(root: HTMLElement, getContext: () => TutorContext | null): void {
  let overlay: HTMLDivElement | null = null;
  let controller: AbortController | null = null;
  let restore: HTMLElement | null = null;
  let requests = 0;
  const cache = new Map<string, TutorSelection>();

  const close = () => {
    controller?.abort();
    controller = null;
    overlay?.remove();
    overlay = null;
    root.removeAttribute("inert");
    restore?.focus({ preventScroll: true });
  };

  const open = () => {
    const context = getContext();
    if (!context || overlay) return;
    const signature = JSON.stringify(context);
    restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay = document.createElement("div");
    overlay.className = "overlay luna-overlay";
    overlay.innerHTML = `<section class="modal wood luna-modal" role="dialog" aria-modal="true" aria-labelledby="luna-title">
      <p class="eyebrow">A little help with this position</p><h2 id="luna-title">Ask Coach</h2>
      <p>Luna picks relevant facts checked by the game. It cannot make a move or change a rule. When you ask, your question and visible board facts go to OpenAI.</p>
      <div class="luna-questions">${TUTOR_QUESTIONS.map((question) => `<button type="button" class="btn" data-luna-question="${escape(question)}">${escape(question)}</button>`).join("")}</div>
      <form class="luna-form"><label for="luna-question">Or ask about this position</label><textarea id="luna-question" maxlength="240" rows="2" placeholder="For example: why isn’t my crew strong enough?"></textarea><button type="submit" class="btn primary">Ask Luna</button></form>
      <div class="luna-answer" role="status" aria-live="polite"><p>Choose a question when you want extra help. Nothing is sent until you ask.</p></div>
      <div class="actions-row"><button type="button" class="btn ghost" data-luna-close>Return to the game</button></div>
    </section>`;
    root.setAttribute("inert", "");
    document.body.appendChild(overlay);
    const panel = overlay;
    const field = panel.querySelector<HTMLTextAreaElement>("textarea")!;
    const answer = panel.querySelector<HTMLElement>(".luna-answer")!;
    const submit = panel.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const revealAnswer = () => answer.scrollIntoView?.({ block: "start" });

    const show = (selection: TutorSelection, source: "luna" | "local") => {
      if (!selection.answerable) {
        answer.innerHTML = "<h3>That goes beyond the facts I have</h3><p>I can help with the current position and the rules shown in this trainer. Try one of the game questions above.</p>";
        revealAnswer();
        return;
      }
      const facts = selection.factIds.flatMap((id) => context.facts.find((fact) => fact.id === id) ?? []);
      answer.innerHTML = `<p class="luna-source">${source === "luna" ? "Selected by Luna · facts checked by the game" : "Local Coach · verified explanation"}</p>${facts.map((fact) => `<section><h3>${escape(fact.title)}</h3><p>${escape(fact.text)}</p></section>`).join("")}`;
      revealAnswer();
    };
    const fallback = () => show({ answerable: true, factIds: ["next", "reason"].filter((id) => context.facts.some((fact) => fact.id === id)) }, "local");
    const ask = async (question: string) => {
      if (!question.trim() || controller) return;
      field.value = question;
      const cacheKey = `${signature}|${question.trim()}`;
      const cached = cache.get(cacheKey);
      if (cached) { show(cached, "luna"); return; }
      if (requests >= 20) {
        fallback();
        answer.insertAdjacentHTML("afterbegin", "<p>Extra AI help has reached its limit for this session. Local guidance is still available.</p>");
        return;
      }
      requests += 1;
      controller = new AbortController();
      const request = controller;
      submit.disabled = true;
      panel.querySelectorAll<HTMLButtonElement>("[data-luna-question]").forEach((button) => { button.disabled = true; });
      answer.textContent = "Finding the relevant rule and board facts…";
      revealAnswer();
      const timeout = window.setTimeout(() => request.abort(), 14000);
      try {
        const response = await fetch(new URL("api/tutor", document.baseURI), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), context }), signal: request.signal,
        });
        if (!response.ok) throw new Error("Tutor unavailable");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") throw new Error("Invalid reply");
        const result = data as Record<string, unknown>;
        if (result.position !== context.position || result.source !== "luna") throw new Error("Wrong position");
        const selection = checkedTutorSelection({ answerable: result.answerable, factIds: result.factIds }, context);
        if (!selection) throw new Error("Unsupported facts");
        if (overlay !== panel) return;
        if (JSON.stringify(getContext()) !== signature) {
          answer.textContent = "The position changed. Return to the game and ask about the new position.";
          return;
        }
        cache.set(cacheKey, selection);
        if (cache.size > 100) cache.delete(cache.keys().next().value ?? "");
        show(selection, "luna");
      } catch {
        if (overlay === panel) {
          if (JSON.stringify(getContext()) === signature) fallback();
          else answer.textContent = "The position changed. Return to the game and ask about the new position.";
        }
      } finally {
        window.clearTimeout(timeout);
        if (controller === request) controller = null;
        if (overlay === panel) {
          submit.disabled = false;
          panel.querySelectorAll<HTMLButtonElement>("[data-luna-question]").forEach((button) => { button.disabled = false; });
        }
      }
    };
    panel.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-luna-close]")) { close(); return; }
      const question = target?.closest<HTMLElement>("[data-luna-question]")?.dataset.lunaQuestion;
      if (question) void ask(question);
    });
    panel.querySelector("form")!.addEventListener("submit", (event) => { event.preventDefault(); void ask(field.value); });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled), textarea")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    panel.querySelector<HTMLButtonElement>("button")?.focus();
  };
  root.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-tutor-open]")) open();
  });
}
