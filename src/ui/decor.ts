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
export const TOPBAR_MAP = `<svg class="topbar-chart" viewBox="0 0 1600 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="topbarChartWash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c9b48a" stop-opacity=".08"/>
      <stop offset="100%" stop-color="#8a7048" stop-opacity=".16"/>
    </linearGradient>
    <pattern id="topbarChartStipple" width="18" height="12" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="3" r=".45" fill="#c4ae82"/>
      <circle cx="11" cy="8" r=".35" fill="#c4ae82"/>
      <circle cx="16" cy="2" r=".3" fill="#b89a6a"/>
    </pattern>
  </defs>
  <rect width="1600" height="90" fill="url(#topbarChartWash)"/>
  <rect width="1600" height="90" fill="url(#topbarChartStipple)" opacity=".55"/>
  <g class="chart-graticule" fill="none" stroke="#c4ae82" stroke-width=".45">
    <path d="M0 22h1600M0 45h1600M0 68h1600"/>
    <path d="M200 0v90M400 0v90M600 0v90M800 0v90M1000 0v90M1200 0v90M1400 0v90"/>
  </g>
  <g class="chart-rhumb" fill="none" stroke="#c4ae82" stroke-width=".4">
    <path d="M1088 38 L1280 8M1088 38 L1320 62M1088 38 L900 6M1088 38 L860 78"/>
  </g>
  <path class="chart-coast" d="M-20 74C60 70 110 52 188 56c78 4 118 22 198 16 70-5 108-24 176-18 62 5 96 24 168 18 78-6 120-28 196-16 70 11 108 8 176-4 64-11 118 8 198 8 62 0 112-16 178-6 40 6 86 16 140 10v22H-20z" fill="#b89a6a"/>
  <path class="chart-shore" d="M-10 72C70 66 128 48 196 54s128 24 206 16 124-26 188-16 118 26 186 14 132-26 210-12 128 14 198 0 140 10 220 8 130-12 202-2" fill="none" stroke="#d8c49a" stroke-width="1.35" stroke-linecap="round"/>
  <path class="chart-hatch" d="M80 78l8 8M140 74l7 8M250 76l8 8M360 80l6 7M490 78l8 8M640 80l7 7M790 76l8 8M940 78l7 8M1100 80l8 7M1260 76l7 8M1420 78l8 8" fill="none" stroke="#c4ae82" stroke-width=".7"/>
  <path class="chart-isle" d="M318 22c18-10 42-6 48 8 6 14-8 22-26 24-20 2-38-10-22-32z" fill="#b89a6a" stroke="#d8c49a" stroke-width=".8"/>
  <path class="chart-isle" d="M704 16c14-8 34-4 38 8 4 11-10 16-22 17-16 1-28-8-16-25z" fill="#b89a6a" stroke="#d8c49a" stroke-width=".75"/>
  <path class="chart-isle" d="M512 40c8-5 18-2 20 5 2 7-6 10-13 10-9 0-15-5-7-15z" fill="#b89a6a" stroke="#d8c49a" stroke-width=".65"/>
  <path class="chart-path" d="M70 64C150 52 230 34 318 26S470 42 512 42 620 28 704 22 820 36 900 32 1000 48 1088 38 1180 28 1288 44 1380 40" fill="none" stroke="#e6d3a4" stroke-width="1.15" stroke-linecap="round" stroke-dasharray="2.2 4.6"/>
  <g class="chart-compass" transform="translate(1088 38)">
    <circle r="16" fill="none" stroke="#d8c49a" stroke-width=".7"/>
    <circle r="10" fill="none" stroke="#c4ae82" stroke-width=".45"/>
    <path d="M0-14 L2.4-2.4 L14 0 L2.4 2.4 L0 14 L-2.4 2.4 L-14 0 L-2.4-2.4 Z" fill="#d8c49a"/>
    <path d="M0-14 L1.1-1.1 L14 0 L1.1 1.1 L0 14 L-1.1 1.1 L-14 0 L-1.1-1.1 Z" fill="#8a7048"/>
    <circle r="1.6" fill="#f0e2c0"/>
  </g>
  <g class="chart-ticks" fill="none" stroke="#c4ae82" stroke-width=".8">
    <path d="M12 8h18M12 8v14M1570 8h18M1588 8v14M12 82h18M12 68v14M1570 82h18M1588 68v14"/>
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
