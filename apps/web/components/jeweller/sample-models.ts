// Inline sample-model placeholders used by the try-on asset calibrator.
//
// These are intentionally low-fidelity SVG portraits — enough for a jeweller
// to see the overlay land on a reasonable anchor (earlobe, collarbone,
// finger). Phase 7 ships these as data URIs so we don't depend on binary
// assets being bundled. Real shop installs can later drop replacement
// photographs in /public/sample-models/ and swap the URLs here.
//
// Sizing convention: every SVG is 800×800 with the subject centered. The
// calibrator's defaultSampleAnchor() uses normalized coordinates against
// that frame so swapping in real photos is a drop-in change.

import type { JewelleryType } from '@luxematch/ar-engine';

function svg(body: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${body}</svg>`,
  );
}

// Light flesh tone backgrounds with simple feature hints. The geometry is
// chosen so the default anchors land in plausible places.
const PORTRAIT_FRONT = svg(`
  <rect width="800" height="800" fill="#f3e3d2"/>
  <ellipse cx="400" cy="360" rx="180" ry="220" fill="#e9c9a9"/>
  <ellipse cx="400" cy="640" rx="240" ry="180" fill="#d8b389"/>
  <circle cx="340" cy="340" r="14" fill="#3a2615"/>
  <circle cx="460" cy="340" r="14" fill="#3a2615"/>
  <path d="M 360 420 Q 400 460 440 420" stroke="#7a4a25" stroke-width="6" fill="none"/>
  <text x="400" y="780" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#7a6852">Sample face — replace with a real portrait in /public</text>
`);

const HAND = svg(`
  <rect width="800" height="800" fill="#f3e3d2"/>
  <rect x="280" y="120" width="240" height="540" rx="120" fill="#e9c9a9"/>
  <rect x="300" y="200" width="40" height="280" rx="20" fill="#e9c9a9"/>
  <rect x="360" y="160" width="44" height="320" rx="22" fill="#e9c9a9"/>
  <rect x="420" y="180" width="44" height="300" rx="22" fill="#e9c9a9"/>
  <rect x="480" y="220" width="40" height="260" rx="20" fill="#e9c9a9"/>
  <text x="400" y="780" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#7a6852">Sample hand — replace with a real photo in /public</text>
`);

export type SampleModel = {
  id: string;
  label: string;
  url: string;
};

export function sampleModelsFor(type: JewelleryType): SampleModel[] {
  if (type === 'ring_index' || type === 'ring_middle' || type === 'bangle') {
    return [{ id: 'hand', label: 'Hand', url: HAND }];
  }
  return [{ id: 'portrait-front', label: 'Front portrait', url: PORTRAIT_FRONT }];
}
