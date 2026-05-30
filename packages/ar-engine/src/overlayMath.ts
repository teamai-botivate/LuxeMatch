import * as THREE from 'three';

import { computeAlphaBounds } from './alphaBounds';
import type { JewelleryType } from './transforms';

export type VisibleBounds = {
  widthLocal: number;
  heightLocal: number;
  centerX: number;
  centerY: number;
  topY: number;
  bottomY: number;
};

/**
 * Compute VisibleBounds for a PNG/JPG in Three.js local space after the
 * standard center + max-dim-normalise transform.
 *
 * Both the live renderer and the calibration preview apply the same transforms;
 * centralising here ensures their positioning math can never drift apart.
 *
 * @param img   The loaded HTMLImageElement
 * @param imgW  Pixel width  (pass texture.image.width or img.naturalWidth)
 * @param imgH  Pixel height
 */
export function imageToVisibleBounds(
  img: HTMLImageElement,
  imgW?: number,
  imgH?: number,
): VisibleBounds {
  const w = imgW ?? img.naturalWidth;
  const h = imgH ?? img.naturalHeight;
  const aspect = w / h;

  const bounds = computeAlphaBounds(img);

  const visW_local = ((bounds.maxX - bounds.minX) / w) * aspect;
  const visH_local = (bounds.maxY - bounds.minY) / h;
  const visCenterX_local = ((bounds.minX + bounds.maxX) / (2 * w) - 0.5) * aspect;
  const visCenterY_local = (bounds.minY + bounds.maxY) / (2 * h) - 0.5;
  const visTopY_local = visCenterY_local - visH_local / 2;
  const visBottomY_local = visCenterY_local + visH_local / 2;

  // PlaneGeometry(aspect, 1) is centred at origin; maxDim = max(aspect, 1).
  const inv = 1 / Math.max(aspect, 1);

  return {
    widthLocal: visW_local * inv,
    heightLocal: visH_local * inv,
    centerX: visCenterX_local * inv,
    centerY: visCenterY_local * inv,
    topY: visTopY_local * inv,
    bottomY: visBottomY_local * inv,
  };
}

/**
 * Build VisibleBounds from a 3D bounding box that has already been centred
 * and normalised (longest dim = 1). Used for GLB/GLTF models where there are
 * no transparent pixels to scan — the full bounding box is the visible region.
 */
export function visibleBoundsFrom3DBox(normSize: THREE.Vector3): VisibleBounds {
  return {
    widthLocal: normSize.x,
    heightLocal: normSize.y,
    centerX: 0,
    centerY: 0,
    topY: -normSize.y / 2,
    bottomY: normSize.y / 2,
  };
}

/**
 * Which point on the VISIBLE pixels lands at the screen (x, y):
 *   earring  → top-center of visible content (hook on the ear lobe)
 *   necklace → 5% down from visible top (skip clasp, land on collarbone)
 *   rings, bangle → visible center
 */
export function selectAnchorPoint(
  vb: VisibleBounds,
  jewelleryType: JewelleryType,
): [number, number] {
  if (jewelleryType === 'earring_left' || jewelleryType === 'earring_right') {
    return [vb.centerX, vb.topY];
  }
  if (jewelleryType === 'necklace') {
    return [vb.centerX, vb.topY + (vb.bottomY - vb.topY) * 0.05];
  }
  return [vb.centerX, vb.centerY];
}

/**
 * Compute the Three.js world-space position for a group so that the chosen
 * anchor point in local space lands exactly at the screen target (x, y) after
 * the group has been rotated by rotationZ and scaled by S.
 */
export function computeGroupPosition(
  x: number,
  y: number,
  anchorLocalX: number,
  anchorLocalY: number,
  rotationZ: number,
  S: number,
): [number, number] {
  const cos = Math.cos(rotationZ);
  const sin = Math.sin(rotationZ);
  const worldDX = (anchorLocalX * cos - anchorLocalY * sin) * S;
  const worldDY = (anchorLocalX * sin + anchorLocalY * cos) * S;
  return [x - worldDX, y - worldDY];
}

/**
 * Flip Three.js PlaneGeometry UVs vertically so textures render right-side-up
 * under the Y-down orthographic camera.
 */
export function flipUVsVertical(geo: THREE.BufferGeometry): void {
  const uvAttr = geo.attributes.uv!;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setY(i, 1.0 - uvAttr.getY(i));
  }
  uvAttr.needsUpdate = true;
}
