/** Original decorative SVGs — abstract atmosphere only, no character likenesses. */

/** Generic pirate-captain pawn for the current location. Not a character likeness. */
export const CAPTAIN_TOKEN = `<svg class="captain-figure" viewBox="0 0 64 80" aria-hidden="true">
  <ellipse cx="32" cy="74" rx="16" ry="4" fill="rgba(8,6,4,.45)"/>
  <path d="M20 44 L16 72 Q32 76 48 72 L44 44 Z" fill="#1c2830"/>
  <path d="M22 46 L20 68 Q32 71 44 68 L42 46 Z" fill="#243844"/>
  <path d="M28 48 L32 70 L36 48" fill="none" stroke="#c9a24a" stroke-width="1.2"/>
  <circle cx="28" cy="56" r="1.3" fill="#e8c36a"/>
  <circle cx="28" cy="62" r="1.3" fill="#e8c36a"/>
  <path d="M14 50 Q8 54 10 62" fill="none" stroke="#d4c4a0" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 61 q4 6 -1 7" fill="none" stroke="#d4c4a0" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M50 52 L54 58" stroke="#3a2a18" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="32" cy="34" rx="9" ry="10" fill="#2a2116"/>
  <path d="M6 26 L32 12 L58 26 L42 24 Q32 28 22 24 Z" fill="#12100c"/>
  <path d="M10 26 L32 16 L54 26" fill="none" stroke="#c9a24a" stroke-width="1.4"/>
  <path d="M18 24 Q32 20 46 24" fill="#1a1812"/>
</svg>`;

export const CREST = `<svg class="crest" viewBox="0 0 92 92" aria-hidden="true">
  <defs>
    <radialGradient id="crestGlow" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fff6d2"/>
      <stop offset="40%" stop-color="#f6e7b0"/>
      <stop offset="70%" stop-color="#d4a84a"/>
      <stop offset="100%" stop-color="#7a4e16"/>
    </radialGradient>
    <radialGradient id="crestFill" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1a1208"/>
      <stop offset="100%" stop-color="#0a0704"/>
    </radialGradient>
  </defs>
  <circle cx="46" cy="46" r="44" fill="url(#crestFill)" stroke="url(#crestGlow)" stroke-width="3"/>
  <circle cx="46" cy="46" r="38.5" fill="none" stroke="#e8c36a" stroke-width="1" opacity=".55"/>
  <circle cx="46" cy="46" r="33" fill="none" stroke="#f4d48a" stroke-width=".6" opacity=".28" stroke-dasharray="2 3"/>
  <path d="M29 29c15-11 36-6 39 13-11 1-18 8-19 16 1 12 11 19 11 19s-23 1-32-15c-5-8-4-23 1-33z" fill="url(#crestGlow)"/>
  <path d="M61 55c10 3 17 13 14 22-10-1-18-9-21-17 2-2 4-4 7-5z" fill="#c24748"/>
  <circle cx="34" cy="33" r="3.2" fill="#120c06"/>
  <circle cx="68" cy="24" r="1.4" fill="#fff6d2" opacity=".75"/>
</svg>`;

export const TITLE_SCENE = `<svg class="title-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <radialGradient id="moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffbee"/>
      <stop offset="42%" stop-color="#fff6d2"/>
      <stop offset="72%" stop-color="#e8c36a"/>
      <stop offset="100%" stop-color="rgba(232,195,106,0)"/>
    </radialGradient>
    <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255,246,210,.22)"/>
      <stop offset="100%" stop-color="rgba(232,195,106,0)"/>
    </radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(18,48,56,0)"/>
      <stop offset="38%" stop-color="rgba(12,36,44,.5)"/>
      <stop offset="100%" stop-color="rgba(6,12,16,.92)"/>
    </linearGradient>
    <linearGradient id="gleam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,246,210,.18)"/>
      <stop offset="100%" stop-color="rgba(232,195,106,0)"/>
    </linearGradient>
  </defs>
  <circle class="moon-halo" cx="940" cy="128" r="118" fill="url(#moonHalo)"/>
  <circle class="moon" cx="940" cy="128" r="72" fill="url(#moon)"/>
  <circle cx="918" cy="116" r="7" fill="rgba(180,140,70,.18)"/>
  <circle cx="958" cy="140" r="4" fill="rgba(180,140,70,.14)"/>
  <path fill="#071018" d="M0 470c80-40 160-90 260-70 90 18 140 70 230 62 70-6 110-50 190-46 95 5 140 58 230 50 70-6 120-48 190-30 50 12 80 40 100 58v206H0z"/>
  <path fill="#0b1620" d="M0 520c90-28 170-20 250 6 70 22 130-10 200-6 90 6 130 40 210 28 95-14 150-8 230 18 70 22 140 8 210-8 40-10 70 4 100 18v124H0z"/>
  <rect x="0" y="430" width="1200" height="270" fill="url(#sea)"/>
  <path d="M930 200v230" stroke="url(#gleam)" stroke-width="14" opacity=".35"/>
  <path d="M180 548c40 0 70-8 110 0M420 560c50 2 80-10 120 2M700 552c40-4 90 6 130-2" fill="none" stroke="rgba(232,195,106,.12)" stroke-width="2"/>
  <g fill="none" stroke="rgba(232,195,106,.16)" stroke-width="1.4">
    <path d="M248 498v-36M268 498v-52M258 446h20"/>
    <path d="M236 498h44"/>
  </g>
</svg>`;

export function locationDecor(id: string): string {
  if (id === "jollyRoger") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      <g fill="none" stroke="rgba(232,195,106,.26)" stroke-width="1.6">
        <circle cx="228" cy="34" r="20"/>
        <circle cx="228" cy="34" r="7"/>
        <path d="M228 12v8M228 48v8M208 34h8M240 34h8"/>
      </g>
      <path d="M16 122h74l14-30h38l12 30h90" fill="none" stroke="rgba(212,90,88,.4)" stroke-width="3"/>
      <path d="M42 122v-50M100 92v-30" stroke="rgba(243,230,196,.22)" stroke-width="2"/>
      <circle cx="42" cy="68" r="3" fill="rgba(244,180,90,.45)"/>
      <path d="M10 12h16M10 12v16M254 12h16M270 12v16M10 148h16M10 132v16M254 148h16M270 132v16" stroke="rgba(232,195,106,.22)" stroke-width="1.4" fill="none"/>
    </svg>`;
  }
  if (id === "skullRock") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      <path d="M168 86l28-44 36 18 22-28 26 54" fill="rgba(243,230,196,.07)" stroke="rgba(230,211,166,.32)" stroke-width="2"/>
      <path d="M176 86l18-22 20 8 16-16" fill="none" stroke="rgba(230,211,166,.2)" stroke-width="1.4"/>
      <path d="M18 132c42-30 92-20 132-8 42 12 82-10 122 8" fill="none" stroke="rgba(230,211,166,.3)" stroke-width="3"/>
      <path d="M10 12h16M10 12v16M254 12h16M270 12v16M10 148h16M10 132v16M254 148h16M270 132v16" stroke="rgba(230,211,166,.2)" stroke-width="1.4" fill="none"/>
    </svg>`;
  }
  if (id === "mermaidLagoon") {
    return `<svg class="loc-art waves" viewBox="0 0 280 160" aria-hidden="true">
      <path class="wave" d="M0 108c40 12 70-12 110 0s70-12 110 0 60 8 60 8v44H0z" fill="rgba(62,196,181,.14)"/>
      <path class="wave delay" d="M0 122c36 10 68-8 104 2s72-10 108 0 68 8 68 8v28H0z" fill="rgba(62,196,181,.22)"/>
      <path d="M0 136c30 6 60-6 90 2s70-8 100 0 90 6 90 6v24H0z" fill="rgba(62,196,181,.12)"/>
      <circle cx="48" cy="72" r="1.6" fill="rgba(255,246,210,.45)"/>
      <circle cx="210" cy="64" r="1.2" fill="rgba(126,231,212,.4)"/>
      <path d="M10 12h16M10 12v16M254 12h16M270 12v16M10 148h16M10 132v16M254 148h16M270 132v16" stroke="rgba(62,196,181,.22)" stroke-width="1.4" fill="none"/>
    </svg>`;
  }
  return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
    <path d="M10 70c30-40 70-50 110-28 20-30 70-36 100-8 18-16 50-14 60 8" fill="rgba(48,92,52,.38)"/>
    <path d="M0 88c40-18 80-8 120 4 36 10 70-10 110 2 30 8 50 4 50 4v20H0z" fill="rgba(32,72,36,.42)"/>
    <circle cx="48" cy="36" r="3" fill="rgba(143,191,106,.5)"/>
    <circle cx="92" cy="22" r="2" fill="rgba(143,191,106,.38)"/>
    <circle cx="160" cy="30" r="2.5" fill="rgba(232,195,106,.34)"/>
    <circle cx="204" cy="44" r="1.6" fill="rgba(255,246,210,.28)"/>
    <path d="M10 12h16M10 12v16M254 12h16M270 12v16M10 148h16M10 132v16M254 148h16M270 132v16" stroke="rgba(143,191,106,.24)" stroke-width="1.4" fill="none"/>
  </svg>`;
}
