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

/**
 * Wide chart strip for the play topbar. Original abstract aged-paper coastline,
 * faint compass, and a dotted voyage path — not a licensed map, not a realm
 * diagram, and it carries no place or character marks.
 */
export const TOPBAR_MAP = `<svg class="topbar-chart" viewBox="0 0 1600 56" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="topbarChartWash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ead7a8" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#c4ae82" stop-opacity=".12"/>
    </linearGradient>
    <pattern id="topbarChartStipple" width="16" height="10" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="3" r=".55" fill="#ead7a8"/>
      <circle cx="10" cy="7" r=".4" fill="#d8c49a"/>
      <circle cx="14" cy="2" r=".35" fill="#c4ae82"/>
    </pattern>
  </defs>
  <rect width="1600" height="56" fill="url(#topbarChartWash)"/>
  <rect width="1600" height="56" fill="url(#topbarChartStipple)" opacity=".7"/>
  <g class="chart-graticule" fill="none" stroke="#ead7a8" stroke-width=".55">
    <path d="M0 14h1600M0 28h1600M0 42h1600"/>
    <path d="M200 0v56M400 0v56M600 0v56M800 0v56M1000 0v56M1200 0v56M1400 0v56"/>
  </g>
  <g class="chart-rhumb" fill="none" stroke="#e6d3a4" stroke-width=".55">
    <path d="M980 28 L1180 4M980 28 L1200 48M980 28 L780 4M980 28 L760 50"/>
  </g>
  <path class="chart-coast" d="M-16 40C70 36 120 22 196 26c70 4 112 16 188 12 64-4 108-16 170-10 58 6 96 16 162 10 70-6 116-18 188-10 64 8 104 6 168-2 58-8 112 6 188 6 54 0 104-10 168-2 36 4 80 10 136 6v20H-16z" fill="#d2b888"/>
  <path class="chart-shore" d="M-8 38C76 32 136 18 200 24s120 18 196 10 118-18 176-10 112 18 176 8 124-18 196-8 118 10 184 0 132 8 208 6 118-8 188 0" fill="none" stroke="#f0e2c0" stroke-width="1.7" stroke-linecap="round"/>
  <path class="chart-hatch" d="M72 44l6 6M140 42l6 6M248 44l6 6M356 46l5 5M488 44l6 6M632 46l6 5M788 42l6 6M936 44l6 6M1096 46l6 5M1256 42l6 6M1416 44l6 6" fill="none" stroke="#e6d3a4" stroke-width=".85"/>
  <path class="chart-isle" d="M336 12c16-8 38-5 44 7 5 11-8 18-24 20-18 2-34-8-20-27z" fill="#d2b888" stroke="#f0e2c0" stroke-width="1"/>
  <path class="chart-isle" d="M692 8c13-7 32-3 36 7 4 9-9 14-20 15-15 1-26-7-16-22z" fill="#d2b888" stroke="#f0e2c0" stroke-width=".95"/>
  <path class="chart-isle" d="M508 22c8-4 17-1 19 5 2 6-6 8-12 8-8 0-14-4-7-13z" fill="#d2b888" stroke="#f0e2c0" stroke-width=".85"/>
  <path class="chart-path" d="M64 36C148 26 226 16 336 14S458 24 508 24 612 14 692 12 812 20 888 18 960 30 980 28 1088 16 1200 26 1320 22" fill="none" stroke="#fff4d4" stroke-width="1.55" stroke-linecap="round" stroke-dasharray="2.4 4.8"/>
  <g class="chart-compass" transform="translate(980 28)">
    <circle r="15" fill="none" stroke="#f0e2c0" stroke-width=".9"/>
    <circle r="9" fill="none" stroke="#e6d3a4" stroke-width=".55"/>
    <path d="M0-13 L2.2-2.2 L13 0 L2.2 2.2 L0 13 L-2.2 2.2 L-13 0 L-2.2-2.2 Z" fill="#f0e2c0"/>
    <path d="M0-13 L1-1 L13 0 L1 1 L0 13 L-1 1 L-13 0 L-1-1 Z" fill="#8a7048"/>
    <circle r="1.5" fill="#fff6d2"/>
  </g>
  <g class="chart-ticks" fill="none" stroke="#ead7a8" stroke-width=".9">
    <path d="M8 6h16M8 6v12M1576 6h16M1592 6v12M8 50h16M8 38v12M1576 50h16M1592 38v12"/>
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
