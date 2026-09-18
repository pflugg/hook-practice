/** Original decorative SVGs — no licensed marks or character likenesses. */

export const CREST = `<svg class="crest" viewBox="0 0 92 92" aria-hidden="true">
  <defs>
    <radialGradient id="crestGlow" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#f6e7b0"/>
      <stop offset="55%" stop-color="#d4a84a"/>
      <stop offset="100%" stop-color="#7a4e16"/>
    </radialGradient>
  </defs>
  <circle cx="46" cy="46" r="44" fill="#120c06" stroke="url(#crestGlow)" stroke-width="3"/>
  <circle cx="46" cy="46" r="37" fill="none" stroke="#e8c36a" stroke-width="1" opacity=".45"/>
  <path d="M29 29c15-11 36-6 39 13-11 1-18 8-19 16 1 12 11 19 11 19s-23 1-32-15c-5-8-4-23 1-33z" fill="#e8c36a"/>
  <path d="M61 55c10 3 17 13 14 22-10-1-18-9-21-17 2-2 4-4 7-5z" fill="#c24748"/>
  <circle cx="34" cy="33" r="3.2" fill="#120c06"/>
</svg>`;

export const TITLE_SCENE = `<svg class="title-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff6d2"/>
      <stop offset="70%" stop-color="#e8c36a"/>
      <stop offset="100%" stop-color="rgba(232,195,106,0)"/>
    </radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(18,48,56,0)"/>
      <stop offset="40%" stop-color="rgba(12,36,44,.55)"/>
      <stop offset="100%" stop-color="rgba(6,12,16,.9)"/>
    </linearGradient>
  </defs>
  <circle class="moon" cx="940" cy="128" r="70" fill="url(#moon)"/>
  <path fill="#071018" d="M0 470c80-40 160-90 260-70 90 18 140 70 230 62 70-6 110-50 190-46 95 5 140 58 230 50 70-6 120-48 190-30 50 12 80 40 100 58v206H0z"/>
  <path fill="#0b1620" d="M0 520c90-28 170-20 250 6 70 22 130-10 200-6 90 6 130 40 210 28 95-14 150-8 230 18 70 22 140 8 210-8 40-10 70 4 100 18v124H0z"/>
  <rect x="0" y="430" width="1200" height="270" fill="url(#sea)"/>
</svg>`;

export function locationDecor(id: string): string {
  if (id === "jollyRoger") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      <g fill="none" stroke="rgba(232,195,106,.22)" stroke-width="2">
        <circle cx="228" cy="36" r="22"/>
        <circle cx="228" cy="36" r="8"/>
        <path d="M228 14v8M228 50v8M206 36h8M242 36h8"/>
      </g>
      <path d="M18 118h70l12-28h36l10 28h86" fill="none" stroke="rgba(212,90,88,.35)" stroke-width="3"/>
      <path d="M40 118v-46M96 90v-28" stroke="rgba(243,230,196,.18)" stroke-width="2"/>
    </svg>`;
  }
  if (id === "skullRock") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      <ellipse cx="210" cy="52" rx="38" ry="30" fill="rgba(243,230,196,.08)" stroke="rgba(230,211,166,.35)" stroke-width="2"/>
      <ellipse cx="198" cy="50" rx="6" ry="8" fill="rgba(10,8,6,.45)"/>
      <ellipse cx="222" cy="50" rx="6" ry="8" fill="rgba(10,8,6,.45)"/>
      <path d="M20 130c40-28 90-18 130-8 40 10 80-8 120 6" fill="none" stroke="rgba(230,211,166,.28)" stroke-width="3"/>
    </svg>`;
  }
  if (id === "mermaidLagoon") {
    return `<svg class="loc-art waves" viewBox="0 0 280 160" aria-hidden="true">
      <path class="wave" d="M0 110c40 12 70-12 110 0s70-12 110 0 60 8 60 8v42H0z" fill="rgba(62,196,181,.16)"/>
      <path class="wave delay" d="M0 124c36 10 68-8 104 2s72-10 108 0 68 8 68 8v26H0z" fill="rgba(62,196,181,.22)"/>
    </svg>`;
  }
  return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
    <path d="M10 70c30-40 70-50 110-28 20-30 70-36 100-8 18-16 50-14 60 8" fill="rgba(48,92,52,.35)"/>
    <path d="M0 88c40-18 80-8 120 4 36 10 70-10 110 2 30 8 50 4 50 4v20H0z" fill="rgba(32,72,36,.4)"/>
    <circle cx="48" cy="36" r="3" fill="rgba(143,191,106,.45)"/>
    <circle cx="92" cy="22" r="2" fill="rgba(143,191,106,.35)"/>
    <circle cx="160" cy="30" r="2.5" fill="rgba(232,195,106,.3)"/>
  </svg>`;
}
