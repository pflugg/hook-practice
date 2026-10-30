/** Original decorative SVGs — abstract atmosphere only, no character likenesses. */

/** Generic pirate-captain pawn for the current location. Not a character likeness. */
export const CAPTAIN_TOKEN = `<svg class="captain-figure" viewBox="0 0 72 92" aria-hidden="true">
  <ellipse cx="36" cy="86" rx="18" ry="4" fill="rgba(8,6,4,.4)"/>
  <path d="M20 48 L14 82 Q36 88 58 82 L52 48 Z" fill="#152028" stroke="#e8c36a" stroke-width="1.4"/>
  <path d="M24 50 L20 78 Q36 82 52 78 L48 50 Z" fill="#2a3c48"/>
  <path d="M32 52 L36 80 L40 52" fill="none" stroke="#e8c36a" stroke-width="1.5"/>
  <circle cx="30" cy="60" r="1.6" fill="#f4d48a"/>
  <circle cx="30" cy="68" r="1.6" fill="#f4d48a"/>
  <path d="M16 56 C6 58 4 70 8 76" fill="none" stroke="#f0e2c0" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M8 75 c6 8 -4 10 -6 4" fill="none" stroke="#f0e2c0" stroke-width="3" stroke-linecap="round"/>
  <path d="M56 58 L62 66" stroke="#2a2116" stroke-width="3" stroke-linecap="round"/>
  <circle cx="36" cy="36" r="11" fill="#3a2e20" stroke="#e8c36a" stroke-width="1.2"/>
  <path d="M4 30 L36 8 L68 30 L48 28 Q36 34 24 28 Z" fill="#0e0c08" stroke="#e8c36a" stroke-width="1.6"/>
  <path d="M14 28 L36 14 L58 28" fill="none" stroke="#c9a24a" stroke-width="2"/>
</svg>`;

/** Thin original chart for the play topbar gap — not a realm map, no place labels. */
export const TOPBAR_MAP = `<svg class="topbar-map" viewBox="0 0 1600 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <g fill="none" stroke="#e8c36a" stroke-width="1">
    <path d="M0 18h1600M0 37h1600"/>
    <path d="M220 0v56M480 0v56M760 0v56M1040 0v56M1320 0v56"/>
  </g>
  <path d="M-12 40C80 34 130 20 210 24c72 4 118 14 190 10 62-4 110-14 172-8 56 5 98 14 164 8 68-6 118-16 186-8 62 7 108 5 170-2 56-6 114 5 186 5 52 0 102-8 166-2 34 3 78 8 130 5v16H-12z" fill="#e8c36a"/>
  <path d="M-6 38C84 30 148 16 214 22s122 16 198 8 120-16 178-8 114 16 178 6 126-16 198-6 120 8 186 0 130 6 206 5 116-6 186 0" fill="none" stroke="#fff6d2" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M348 11c15-7 36-4 41 6 5 10-8 16-22 18-17 2-32-7-19-24z" fill="#e8c36a" stroke="#fff6d2" stroke-width="1.2"/>
  <path d="M704 8c12-6 30-3 34 6 3 8-8 13-19 14-14 1-24-6-15-20z" fill="#e8c36a" stroke="#fff6d2" stroke-width="1.2"/>
  <path d="M70 34C160 24 250 16 348 14S470 22 520 22 620 12 704 10 820 18 900 16 980 28 1010 26 1120 16 1240 24 1360 20 1480 24" fill="none" stroke="#fff6d2" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.4 4.2"/>
  <g transform="translate(1010 26)" fill="none" stroke="#fff6d2" stroke-width="1.2">
    <circle r="12"/>
    <circle r="6.5" stroke="#e8c36a" stroke-width=".8"/>
    <path d="M0-10 L1.8-1.6 L10 0 L1.8 1.6 L0 10 L-1.8 1.6 L-10 0 L-1.8-1.6 Z" fill="#fff6d2" stroke="none"/>
    <path d="M0-10 L.8-.8 L10 0 L.8.8 L0 10 L-.8.8 L-10 0 L-.8-.8 Z" fill="#e8c36a" stroke="none"/>
  </g>
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

const CHART_CORNERS = `<path d="M12 28V12H28M252 12h16v16M12 132v16h16M252 148h16v-16" fill="none" stroke="#6a4a22" stroke-width="1.6" opacity=".55"/>`;

/** Original ink drawings for each shore. Generic chart sketches — not character likenesses. */
export function locationDecor(id: string): string {
  if (id === "jollyRoger") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      ${CHART_CORNERS}
      <path d="M18 128c28 8 48-6 78-2 22 3 36 8 58 6 24-2 40 6 70 4 16-1 28 2 40 4" fill="none" stroke="#3e6270" stroke-width="2" opacity=".55"/>
      <path d="M48 118 L78 132 H198 L228 114 L196 122 H80 Z" fill="#7a4034" stroke="#3a2416" stroke-width="1.5"/>
      <path d="M86 122 V58 M142 122 V46 M188 122 V66" stroke="#3a2416" stroke-width="2"/>
      <path d="M90 62 h34 v24 H90 Z M90 90 h28 v16 H90 Z" fill="#f7edd4" stroke="#3a2416" stroke-width="1.2"/>
      <path d="M146 50 h40 v28 h-40 Z M146 82 h34 v20 h-34 Z" fill="#f7edd4" stroke="#3a2416" stroke-width="1.2"/>
      <path d="M142 46 l18 7 -18 6 Z" fill="#a3453c"/>
      <path d="M188 70 h22 v16 h-22 Z" fill="#f3e2bc" stroke="#3a2416" stroke-width="1"/>
      <circle cx="118" cy="126" r="2" fill="#f0d48a"/>
    </svg>`;
  }
  if (id === "skullRock") {
    return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
      ${CHART_CORNERS}
      <path d="M28 138 C48 108 62 96 84 104 C70 118 52 128 40 138 Z" fill="#cbb892" stroke="#4a3820" stroke-width="1.5"/>
      <path d="M78 140 C96 92 132 70 168 78 C150 96 124 112 108 140 C96 118 84 124 78 140 Z" fill="#d4c09a" stroke="#4a3820" stroke-width="1.6"/>
      <path d="M150 140 C168 78 214 64 248 108 L236 140 C214 112 186 118 164 140 C158 124 152 128 150 140 Z" fill="#e2d2b0" stroke="#4a3820" stroke-width="1.6"/>
      <path d="M168 140 Q196 108 224 140" fill="#2a2218"/>
      <path d="M16 142c36-10 70-4 108 0 40 4 70-8 112 0 28 6 36 2 44 2" fill="none" stroke="#5c4630" stroke-width="2" opacity=".65"/>
    </svg>`;
  }
  if (id === "mermaidLagoon") {
    return `<svg class="loc-art waves" viewBox="0 0 280 160" aria-hidden="true">
      ${CHART_CORNERS}
      <path d="M156 108 Q178 72 206 100 Q184 116 156 108 Z" fill="#6e9464" stroke="#2e4a30" stroke-width="1.2"/>
      <path d="M168 96 Q176 78 186 92" fill="none" stroke="#2e4a30" stroke-width="1.3"/>
      <path class="wave" d="M0 112c36 12 64-14 102 0s66-12 102 0 48 10 76 6v42H0z" fill="#2f8f86" opacity=".28"/>
      <path class="wave delay" d="M0 126c32 10 60-10 96 2s68-12 104 0 52 8 80 6v28H0z" fill="#1f6e78" opacity=".34"/>
      <path d="M8 96c18-8 28 4 40-2" fill="none" stroke="#e8f6f2" stroke-width="1.4" opacity=".45"/>
      <circle cx="46" cy="88" r="1.5" fill="#f6edd4"/>
      <circle cx="228" cy="78" r="1.3" fill="#d5f3ee"/>
    </svg>`;
  }
  return `<svg class="loc-art" viewBox="0 0 280 160" aria-hidden="true">
    ${CHART_CORNERS}
    <path d="M24 138 L58 86 L92 138 Z" fill="#3f6b40" stroke="#24381e" stroke-width="1.2"/>
    <path d="M78 138 L118 58 L162 138 Z" fill="#2f5a34" stroke="#1c3018" stroke-width="1.3"/>
    <path d="M148 138 L186 74 L228 138 Z" fill="#4e7a48" stroke="#24381e" stroke-width="1.2"/>
    <path d="M112 138 V108" stroke="#3a2a18" stroke-width="3"/>
    <ellipse cx="112" cy="116" rx="9" ry="12" fill="#24180e"/>
    <path d="M18 142h244" stroke="#5a4630" stroke-width="1.6" opacity=".55"/>
    <circle cx="168" cy="70" r="2" fill="#d7ecb8" opacity=".8"/>
  </svg>`;
}

/** Margin compass for the realm chart. Original rose — no place names. */
export const MAP_COMPASS = `<svg class="map-compass" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="#f3e2bc" stroke="#4a3016" stroke-width="2.4"/>
  <circle cx="32" cy="32" r="26" fill="none" stroke="#4a3016" stroke-width="1"/>
  <circle cx="32" cy="32" r="18" fill="none" stroke="#a07840" stroke-width=".8" stroke-dasharray="1.5 2"/>
  <g stroke="#4a3016" stroke-width="1.1">
    <path d="M32 2.5 V7 M32 57 V61.5 M2.5 32 H7 M57 32 H61.5"/>
    <path d="M10 10 L14 14 M54 10 L50 14 M10 54 L14 50 M54 54 L50 50" stroke-width=".8"/>
  </g>
  <path d="M32 8 L38 32 L32 56 L26 32 Z" fill="#8d3a34"/>
  <path d="M32 8 L34.2 32 L32 56 L29.8 32 Z" fill="#f3d7a2"/>
  <path d="M8 32 L32 26 L56 32 L32 38 Z" fill="#5a3818"/>
  <path d="M8 32 L32 30 L56 32 L32 34 Z" fill="#e7c98a"/>
  <circle cx="32" cy="32" r="3.2" fill="#f6e7c2" stroke="#3a2414" stroke-width="1"/>
  <text x="32" y="12" text-anchor="middle" font-size="7" font-family="Palatino, serif" fill="#3a2414">N</text>
  <text x="32" y="61" text-anchor="middle" font-size="6" font-family="Palatino, serif" fill="#3a2414">S</text>
  <text x="8.5" y="34.5" font-size="6" font-family="Palatino, serif" fill="#3a2414">W</text>
  <text x="50" y="34.5" font-size="6" font-family="Palatino, serif" fill="#3a2414">E</text>
</svg>`;

/**
 * Realm chart painted behind the four shores.
 * Resolve against Vite's base so a submission hosted in a subfolder keeps its chart.
 * The illustration is backdrop only. Movement is still any unlocked shore.
 */
export const TREASURE_MAP = `<img class="map-scene" src="${import.meta.env.BASE_URL}assets/treasure-map.png" alt="" width="3000" height="1680" aria-hidden="true" />`;

/** Decorative shoreline under the four shores. Not a movement rule. */
export const MAP_COAST = `<svg class="map-coast" viewBox="0 0 800 18" preserveAspectRatio="none" aria-hidden="true">
  <path d="M4 6 H796" fill="none" stroke="#6b4a22" stroke-width="1.5" stroke-dasharray="8 7" stroke-linecap="round"/>
  <path d="M0 14 C48 8 86 16 132 11 C190 5 228 15 286 11 C352 6 390 15 454 11 C520 7 560 16 624 11 C690 6 730 14 800 12" fill="none" stroke="#3e5c62" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;
