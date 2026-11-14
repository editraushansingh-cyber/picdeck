import sharp from "sharp";

/**
 * Background library ("PSD backgrounds" equivalent).
 *
 * The original product ships layered Photoshop files. This implementation
 * renders the same look as high-resolution flattened backdrops — print-ready
 * JPEGs that photographers can drop behind album spreads or client cards.
 * Swap `renderBackdrop` for a file lookup when a real PSD pack is supplied.
 */

export type BackdropMotif = "arch" | "floral" | "rays" | "bokeh" | "marble" | "stars" | "waves" | "dots";

export type Backdrop = {
  id: string;
  name: string;
  palette: [string, string, string];
  motif: BackdropMotif;
  tone: "light" | "dark";
};

export const BACKDROPS: Backdrop[] = [
  { id: "ivory-arch", name: "Ivory Arch", palette: ["#f7efe2", "#e7d3b3", "#b08d57"], motif: "arch", tone: "light" },
  { id: "marigold-rays", name: "Marigold Rays", palette: ["#fff4dd", "#f6c667", "#c07c12"], motif: "rays", tone: "light" },
  { id: "rose-bloom", name: "Rose Bloom", palette: ["#fdf1f3", "#f2c2cc", "#b65d76"], motif: "floral", tone: "light" },
  { id: "midnight-stars", name: "Midnight Stars", palette: ["#0e1730", "#1e2c55", "#8fa6ff"], motif: "stars", tone: "dark" },
  { id: "emerald-marble", name: "Emerald Marble", palette: ["#eef6f1", "#bcd9c9", "#2f6b4f"], motif: "marble", tone: "light" },
  { id: "champagne-bokeh", name: "Champagne Bokeh", palette: ["#20180f", "#5c4526", "#f0cf8a"], motif: "bokeh", tone: "dark" },
  { id: "terracotta-waves", name: "Terracotta Waves", palette: ["#fbeee7", "#e9b699", "#a34d2c"], motif: "waves", tone: "light" },
  { id: "indigo-dots", name: "Indigo Dots", palette: ["#eef2ff", "#c3ceff", "#3b4fa8"], motif: "dots", tone: "light" },
];

export function backdropById(id: string) {
  return BACKDROPS.find((backdrop) => backdrop.id === id) ?? null;
}

function motifMarkup(motif: BackdropMotif, accent: string, ink: string) {
  switch (motif) {
    case "arch":
      return `<path d="M700 1500V900a300 300 0 0 1 600 0v600Z" fill="none" stroke="${ink}" stroke-width="10" opacity="0.5"/>
        <path d="M780 1500V930a220 220 0 0 1 440 0v570Z" fill="${accent}" opacity="0.18"/>`;
    case "rays":
      return Array.from({ length: 14 }, (_, index) => {
        const angle = (index * 180) / 14;
        return `<rect x="990" y="0" width="20" height="1600" fill="${ink}" opacity="0.12" transform="rotate(${angle} 1000 1000)"/>`;
      }).join("");
    case "floral":
      return Array.from({ length: 9 }, (_, index) => {
        const x = 180 + (index % 3) * 560;
        const y = 300 + Math.floor(index / 3) * 460;
        return `<g transform="translate(${x} ${y})" fill="none" stroke="${ink}" stroke-width="7" opacity="0.42">
          ${Array.from({ length: 5 }, (_, petal) => `<ellipse cx="0" cy="-90" rx="52" ry="100" transform="rotate(${petal * 72})"/>`).join("")}
          <circle r="18" fill="${accent}" stroke="none" opacity="0.9"/>
        </g>`;
      }).join("");
    case "stars":
      return Array.from({ length: 70 }, (_, index) => {
        const x = (index * 197) % 1900 + 50;
        const y = (index * 331) % 1900 + 50;
        const r = 2 + (index % 4);
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="${0.25 + (index % 5) * 0.12}"/>`;
      }).join("");
    case "marble":
      return Array.from({ length: 6 }, (_, index) => {
        const y = 200 + index * 300;
        return `<path d="M0 ${y} C 420 ${y - 160}, 900 ${y + 180}, 2000 ${y - 40}" fill="none" stroke="${ink}" stroke-width="${10 + index * 2}" opacity="0.16"/>`;
      }).join("");
    case "bokeh":
      return Array.from({ length: 22 }, (_, index) => {
        const x = (index * 271) % 1900;
        const y = (index * 431) % 1900;
        const r = 40 + (index % 6) * 34;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="0.10"/>`;
      }).join("");
    case "waves":
      return Array.from({ length: 7 }, (_, index) => {
        const y = 300 + index * 230;
        return `<path d="M0 ${y} Q 500 ${y - 150} 1000 ${y} T 2000 ${y}" fill="none" stroke="${ink}" stroke-width="8" opacity="0.28"/>`;
      }).join("");
    case "dots":
      return Array.from({ length: 12 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => {
          const x = 120 + col * 160 + (row % 2 ? 80 : 0);
          const y = 160 + row * 160;
          return `<circle cx="${x}" cy="${y}" r="6" fill="${ink}" opacity="0.22"/>`;
        }).join(""),
      ).join("");
  }
}

export function backdropSvg(id: string, size = 2000) {
  const backdrop = backdropById(id);
  if (!backdrop) return null;
  const [light, mid, accent] = backdrop.palette;
  const ink = backdrop.tone === "dark" ? accent : mid;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2000 2000">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${light}"/>
        <stop offset="0.55" stop-color="${mid}"/>
        <stop offset="1" stop-color="${light}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.30"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="2000" height="2000" fill="url(#bg)"/>
    <rect width="2000" height="2000" fill="url(#glow)"/>
    ${motifMarkup(backdrop.motif, accent, ink)}
    <rect x="70" y="70" width="1860" height="1860" fill="none" stroke="${ink}" stroke-width="4" opacity="0.35"/>
  </svg>`;
}

export async function renderBackdrop(id: string, width: number) {
  const svg = backdropSvg(id);
  if (!svg) return null;
  return sharp(Buffer.from(svg))
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
