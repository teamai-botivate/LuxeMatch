export { OneEuroFilter } from './oneEuroFilter';

export {
  imageToVisibleBounds,
  visibleBoundsFrom3DBox,
  selectAnchorPoint,
  computeGroupPosition,
  flipUVsVertical,
  type VisibleBounds,
} from './overlayMath';

export {
  mirrorLandmarks,
  smoothLandmarks,
  resetSmootherPool,
  type Landmark,
} from './landmarkSmoother';

export { FACE_LM_USED, HAND_LM_USED, POSE_LM_USED } from './anchors';

export { computeAlphaBounds, type AlphaBounds } from './alphaBounds';

export {
  computeOverlay,
  applyCalibration,
  type Overlay,
  type Calibration,
  type HandResult,
  type JewelleryType,
} from './transforms';

export { ARRenderer } from './renderer';

export {
  renderPreview,
  defaultSampleAnchor,
  type PreviewParams,
  type SampleAnchor,
} from './preview';

export {
  TryOnEngine,
  type EngineMetrics,
  type EngineOptions,
  type EngineStatus,
} from './engine';

export const PACKAGE_NAME = '@luxematch/ar-engine';
