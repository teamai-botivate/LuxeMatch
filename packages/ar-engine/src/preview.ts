import * as THREE from 'three';

import { computeAlphaBounds } from './alphaBounds';
import {
  applyCalibration,
  type Calibration,
  type JewelleryType,
  type Overlay,
} from './transforms';

// ────────────────────────────────────────────────────────────────────────────
// Static preview overlay
//
// Renders a transparent PNG on top of a sample model image using the same
// renderer math as the live engine, but driven by SYNTHETIC overlay values
// instead of MediaPipe landmarks. The calibrator uses this so jewellers see
// exactly what their customers will see, without needing a camera.
//
// Anchor/scale/rotation logic MUST stay in sync with renderer.ts — the
// calibrator preview lying to the jeweller would be the worst possible bug.
// ────────────────────────────────────────────────────────────────────────────

export type SampleAnchor = {
  /** Where the overlay should land on the sample image, in pixels. */
  x: number;
  y: number;
  /** Overlay width (visible pixels). The renderer scales the asset to match. */
  baseScale: number;
  /** Base rotation in radians. 0 for face-forward sample models. */
  baseRotation: number;
};

export type PreviewParams = {
  sampleImage: HTMLImageElement;
  assetImage: HTMLImageElement;
  jewelleryType: JewelleryType;
  anchor: SampleAnchor;
  calibration: Calibration | null;
};

/**
 * Render the asset onto a fresh transparent canvas matching the sample's
 * intrinsic dimensions. The caller stacks this on top of an <img> of the
 * sample model however they want.
 */
export function renderPreview(params: PreviewParams): HTMLCanvasElement {
  const { sampleImage, assetImage, jewelleryType, anchor, calibration } = params;
  const W = sampleImage.naturalWidth;
  const H = sampleImage.naturalHeight;

  const base: Overlay = {
    position: [anchor.x, anchor.y],
    scale: anchor.baseScale,
    rotationZ: anchor.baseRotation,
    confidence: 1,
  };
  const overlay = applyCalibration(base, calibration);
  if (!overlay.position) {
    throw new Error('Preview overlay has no position');
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setSize(W, H, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, W, 0, H, 0.1, 1000);
  camera.position.z = 500;

  const texture = new THREE.Texture(assetImage);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const imgW = assetImage.naturalWidth;
  const imgH = assetImage.naturalHeight;
  const aspect = imgW / imgH;
  const bounds = computeAlphaBounds(assetImage);
  const visW = (bounds.maxX - bounds.minX) / imgW;
  const visH = (bounds.maxY - bounds.minY) / imgH;
  const visCenterU = (bounds.minX + bounds.maxX) / (2 * imgW);
  const visCenterV = (bounds.minY + bounds.maxY) / (2 * imgH);
  const visW_local = visW * aspect;
  const visH_local = visH * 1;
  const visCenterX_local = (visCenterU - 0.5) * aspect;
  const visCenterY_local = (visCenterV - 0.5) * 1;
  const visTopY_local = visCenterY_local - visH_local / 2;
  const visBottomY_local = visCenterY_local + visH_local / 2;

  const geo = new THREE.PlaneGeometry(aspect, 1);
  const uvAttr = geo.attributes.uv!;
  for (let i = 0; i < uvAttr.count; i++) uvAttr.setY(i, 1.0 - uvAttr.getY(i));
  uvAttr.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: 0.02,
    toneMapped: false,
  });
  const baseMesh = new THREE.Mesh(geo, mat);

  const box = new THREE.Box3().setFromObject(baseMesh);
  const center = box.getCenter(new THREE.Vector3());
  baseMesh.position.sub(center);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) baseMesh.scale.set(1 / maxDim, 1 / maxDim, 1 / maxDim);

  const wrapper = new THREE.Group();
  wrapper.add(baseMesh);
  scene.add(wrapper);

  const inv = 1 / (maxDim || 1);
  const vb = {
    widthLocal: visW_local * inv,
    centerX: (visCenterX_local - center.x) * inv,
    centerY: (visCenterY_local - center.y) * inv,
    topY: (visTopY_local - center.y) * inv,
    bottomY: (visBottomY_local - center.y) * inv,
  };

  const [x, y] = overlay.position;
  const S = overlay.scale / (vb.widthLocal || 1);
  wrapper.scale.set(S, S, S);
  wrapper.rotation.set(0, 0, overlay.rotationZ);

  let anchorLocalX = vb.centerX;
  let anchorLocalY = vb.centerY;
  if (jewelleryType === 'earring_left' || jewelleryType === 'earring_right') {
    anchorLocalY = vb.topY;
  } else if (jewelleryType === 'necklace') {
    anchorLocalY = vb.topY + (vb.bottomY - vb.topY) * 0.05;
  }

  const cos = Math.cos(overlay.rotationZ);
  const sin = Math.sin(overlay.rotationZ);
  const worldDX = (anchorLocalX * cos - anchorLocalY * sin) * S;
  const worldDY = (anchorLocalX * sin + anchorLocalY * cos) * S;
  wrapper.position.set(x - worldDX, y - worldDY, 0);

  renderer.render(scene, camera);

  geo.dispose();
  mat.dispose();
  texture.dispose();
  renderer.dispose();

  return canvas;
}

/**
 * Sensible default anchors for each jewellery type, in normalized [0,1] image
 * coordinates against the sample's intrinsic dimensions. The calibrator uses
 * these unless the jeweller has overridden them.
 */
export function defaultSampleAnchor(
  jewelleryType: JewelleryType,
  imageWidth: number,
  imageHeight: number,
): SampleAnchor {
  const w = imageWidth;
  const h = imageHeight;
  switch (jewelleryType) {
    case 'earring_left':
      return { x: w * 0.32, y: h * 0.38, baseScale: w * 0.06, baseRotation: 0 };
    case 'earring_right':
      return { x: w * 0.68, y: h * 0.38, baseScale: w * 0.06, baseRotation: 0 };
    case 'necklace':
      return { x: w * 0.5, y: h * 0.58, baseScale: w * 0.28, baseRotation: 0 };
    case 'ring_index':
    case 'ring_middle':
      return { x: w * 0.5, y: h * 0.5, baseScale: w * 0.08, baseRotation: 0 };
    case 'bangle':
      return { x: w * 0.5, y: h * 0.65, baseScale: w * 0.22, baseRotation: 0 };
  }
}
