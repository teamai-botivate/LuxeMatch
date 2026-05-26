'use client';

import {
  defaultSampleAnchor,
  renderPreview,
  type Calibration,
  type JewelleryType,
  type SampleAnchor,
} from '@luxematch/ar-engine';
import type { TryOnAssetRow } from '@luxematch/db';
import { Loader2, RotateCcw, Save, Trash2, Upload as UploadIcon } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MediaUploader, { type UploadResult } from '@/components/upload/MediaUploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import { sampleModelsFor } from './sample-models';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

const JEWELLERY_TYPES: { value: JewelleryType; label: string }[] = [
  { value: 'necklace', label: 'Necklace' },
  { value: 'earring_left', label: 'Earring (left)' },
  { value: 'earring_right', label: 'Earring (right)' },
  { value: 'ring_index', label: 'Ring (index)' },
  { value: 'ring_middle', label: 'Ring (middle)' },
  { value: 'bangle', label: 'Bangle' },
];

const DEFAULT_CALIBRATION: Calibration = {
  pivot_x: 0.5,
  pivot_y: 0.5,
  x_offset: 0,
  y_offset: 0,
  scale_multiplier: 1.0,
  rotation_offset_deg: 0,
};

type Props = {
  productId: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function TryOnAssetCalibrator({ productId }: Props) {
  const [assets, setAssets] = useState<TryOnAssetRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch this product's try-on assets via the existing tryon/products
  // endpoint — single round trip and we filter client-side.
  const reloadAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/tryon/products', { cache: 'no-store' });
      const json = (await res.json()) as
        | { data: { products: Array<{ id: string; assets: TryOnAssetRow[] }> } }
        | { error: { message: string } };
      if ('error' in json) {
        setLoadError(json.error.message);
        return;
      }
      const product = json.data.products.find((p) => p.id === productId);
      const list = product?.assets ?? [];
      setAssets(list);
      // Default selection: first asset if nothing chosen yet.
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load assets');
    }
  }, [productId]);

  useEffect(() => {
    void reloadAssets();
  }, [reloadAssets]);

  const activeAsset = useMemo(() => assets?.find((a) => a.id === activeId) ?? null, [assets, activeId]);

  // ── Upload path ──────────────────────────────────────────────────────────

  async function onUploadComplete(jewelleryType: JewelleryType, result: UploadResult) {
    setUploading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/tryon-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          cloudinaryPublicId: result.publicId,
          assetUrl: result.secureUrl,
          jewelleryType,
          isActive: true,
        }),
      });
      const json = (await res.json()) as
        | { data: TryOnAssetRow }
        | { error: { message: string } };
      if ('error' in json) {
        setLoadError(json.error.message);
        return;
      }
      await reloadAssets();
      setActiveId(json.data.id);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-6" data-testid="tryon-calibrator">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Try-on assets</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a transparent PNG, then drag the sliders until the placement looks right.
            The customer-facing AR engine uses the exact same math you see in the preview.
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{loadError}</div>
      ) : null}

      {/* Existing assets — tabs */}
      {assets && assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                a.id === activeId
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#7a6234]'
                  : 'border-border bg-background hover:border-foreground/30'
              }`}
            >
              {a.jewellery_type.replace('_', ' ')}
              {!a.is_active ? ' · paused' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Calibrator for active asset */}
      {activeAsset ? (
        <CalibratorPanel
          key={activeAsset.id}
          asset={activeAsset}
          onSaved={(updated) => {
            setAssets((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
          }}
          onDeleted={async () => {
            setActiveId(null);
            await reloadAssets();
          }}
        />
      ) : assets && assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No try-on assets for this product yet. Upload a transparent PNG below to get started.
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {/* Upload section */}
      <div className="space-y-3 rounded-2xl border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UploadIcon className="h-4 w-4" /> Add a new try-on asset
        </div>
        <NewAssetUploader uploading={uploading} onUploadComplete={onUploadComplete} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// New-asset uploader — choose type, then drop a PNG.
// ────────────────────────────────────────────────────────────────────────────

function NewAssetUploader({
  uploading,
  onUploadComplete,
}: {
  uploading: boolean;
  onUploadComplete: (t: JewelleryType, r: UploadResult) => void;
}) {
  const [pendingType, setPendingType] = useState<JewelleryType>('necklace');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {JEWELLERY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setPendingType(t.value)}
            disabled={uploading}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              pendingType === t.value
                ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#7a6234]'
                : 'border-border bg-background hover:border-foreground/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <MediaUploader
        bucket="tryon"
        label="Drop a transparent PNG here, or click to browse"
        onUploadComplete={(r) => onUploadComplete(pendingType, r)}
      />
      {uploading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving asset…
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Calibrator panel — sliders + live preview for one asset.
// ────────────────────────────────────────────────────────────────────────────

function calibrationFromRow(a: TryOnAssetRow): Calibration {
  return {
    pivot_x: a.pivot_x,
    pivot_y: a.pivot_y,
    x_offset: a.x_offset,
    y_offset: a.y_offset,
    scale_multiplier: a.scale_multiplier,
    rotation_offset_deg: a.rotation_offset_deg,
  };
}

function CalibratorPanel({
  asset,
  onSaved,
  onDeleted,
}: {
  asset: TryOnAssetRow;
  onSaved: (updated: TryOnAssetRow) => void;
  onDeleted: () => void;
}) {
  const [calibration, setCalibration] = useState<Calibration>(() => calibrationFromRow(asset));
  const [isActive, setIsActive] = useState<boolean>(asset.is_active);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  // Sample model + asset images loaded into HTMLImageElement so renderPreview
  // can pass them straight into Three.js / canvas2d alpha scan.
  const samples = useMemo(() => sampleModelsFor(asset.jewellery_type), [asset.jewellery_type]);
  const [sampleId, setSampleId] = useState<string>(samples[0]?.id ?? '');
  const sampleUrl = samples.find((s) => s.id === sampleId)?.url ?? samples[0]?.url ?? '';

  const [sampleImg, setSampleImg] = useState<HTMLImageElement | null>(null);
  const [assetImg, setAssetImg] = useState<HTMLImageElement | null>(null);
  const [loadIssue, setLoadIssue] = useState<string | null>(null);

  // Load both images. crossOrigin=anonymous is mandatory for the alpha scan
  // to read pixels without tainting the canvas — Cloudinary delivery URLs
  // serve the right CORS headers by default.
  useEffect(() => {
    setLoadIssue(null);
    setSampleImg(null);
    const img = new globalThis.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setSampleImg(img);
    img.onerror = () => setLoadIssue('Could not load the sample model image.');
    img.src = sampleUrl;
  }, [sampleUrl]);

  useEffect(() => {
    setAssetImg(null);
    const img = new globalThis.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setAssetImg(img);
    img.onerror = () =>
      setLoadIssue(
        'Could not load the try-on PNG. If it lives outside Cloudinary, the alpha scan may have been blocked by CORS.',
      );
    img.src = asset.asset_url;
  }, [asset.asset_url]);

  // Compute the anchor once per (sample, type) — the live preview re-renders
  // on every slider change, so anchor stability matters.
  const anchor: SampleAnchor | null = useMemo(() => {
    if (!sampleImg) return null;
    return defaultSampleAnchor(asset.jewellery_type, sampleImg.naturalWidth, sampleImg.naturalHeight);
  }, [sampleImg, asset.jewellery_type]);

  // Re-render preview on any input change.
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sampleImg || !assetImg || !anchor) return;
    const container = previewContainerRef.current;
    if (!container) return;
    let cancelled = false;

    // Defer to next microtask so React's commit completes first; otherwise
    // the WebGL renderer attaches to a canvas that's about to be unmounted.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const canvas = renderPreview({
          sampleImage: sampleImg,
          assetImage: assetImg,
          jewelleryType: asset.jewellery_type,
          anchor,
          calibration,
        });
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
        // Replace any previous overlay canvas in the container.
        const existing = container.querySelector('canvas');
        if (existing) container.removeChild(existing);
        container.appendChild(canvas);
      } catch (e) {
        setLoadIssue(e instanceof Error ? e.message : 'Preview render failed');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sampleImg, assetImg, anchor, asset.jewellery_type, calibration]);

  // ── Slider helpers ───────────────────────────────────────────────────────

  function patch<K extends keyof Calibration>(key: K, v: Calibration[K]) {
    setCalibration((prev) => ({ ...prev, [key]: v }));
  }

  function reset() {
    setCalibration(DEFAULT_CALIBRATION);
  }

  // ── Save / delete ────────────────────────────────────────────────────────

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/tryon-assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pivotX: calibration.pivot_x,
          pivotY: calibration.pivot_y,
          xOffset: calibration.x_offset,
          yOffset: calibration.y_offset,
          scaleMultiplier: calibration.scale_multiplier,
          rotationOffsetDeg: calibration.rotation_offset_deg,
          isActive,
        }),
      });
      const json = (await res.json()) as
        | { data: TryOnAssetRow }
        | { error: { message: string } };
      if ('error' in json) {
        setSaveError(json.error.message);
        return;
      }
      onSaved(json.data);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this try-on asset? The PNG will be removed from Cloudinary too.')) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/tryon-assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message: string } };
        setSaveError(json.error?.message ?? 'Delete failed');
        return;
      }
      setDeleted(true);
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  if (deleted) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
      {/* Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Live preview · {asset.jewellery_type.replace('_', ' ')}
          </Label>
          {samples.length > 1 && (
            <div className="flex gap-1">
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSampleId(s.id)}
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    sampleId === s.id ? 'bg-foreground text-background' : 'bg-muted'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={previewContainerRef}
          className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted/30"
        >
          {sampleUrl && (
            // Sample image lives underneath; the calibrator canvas mounts
            // absolutely positioned over it via the useEffect above.
            <Image
              src={sampleUrl}
              alt="Sample model"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-contain"
              unoptimized
            />
          )}
          {!assetImg && !loadIssue && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Loading asset…
            </div>
          )}
        </div>

        {loadIssue ? (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{loadIssue}</div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          PNG: <span className="font-mono">{asset.cloudinary_public_id ?? asset.asset_url}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-5">
        <SliderRow
          label="Horizontal offset"
          value={calibration.x_offset ?? 0}
          onChange={(v) => patch('x_offset', v)}
          min={-200}
          max={200}
          step={1}
          suffix=" px"
        />
        <SliderRow
          label="Vertical offset"
          value={calibration.y_offset ?? 0}
          onChange={(v) => patch('y_offset', v)}
          min={-200}
          max={200}
          step={1}
          suffix=" px"
        />
        <SliderRow
          label="Scale"
          value={calibration.scale_multiplier ?? 1}
          onChange={(v) => patch('scale_multiplier', v)}
          min={0.3}
          max={3}
          step={0.01}
          formatValue={(v) => v.toFixed(2) + '×'}
        />
        <SliderRow
          label="Rotation"
          value={calibration.rotation_offset_deg ?? 0}
          onChange={(v) => patch('rotation_offset_deg', v)}
          min={-180}
          max={180}
          step={1}
          suffix="°"
        />

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor={`active-${asset.id}`} className="text-sm">
            Active
          </Label>
          <Switch id={`active-${asset.id}`} checked={isActive} onCheckedChange={setIsActive} />
        </div>

        {saveError ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving} size="sm" className="flex-1">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button onClick={reset} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button onClick={remove} variant="ghost" size="sm" disabled={saving}>
            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
            <span className="text-red-600">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Slider row
// ────────────────────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  formatValue?: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatValue ? formatValue(value) : value + (suffix ?? '')}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}
