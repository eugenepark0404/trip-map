import { useEffect, useRef, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { loadRegions, type RegionFeature } from '../lib/regions'
import { boundsOf, imageTransformOf } from '../lib/photoPlacement'
import type { PhotoPlacement } from '../lib/types'

const EDITOR_SIZE = 320

export function PhotoPlacementEditor({
  regionCodes,
  imageUrl,
  initialPlacement,
  onConfirm,
  onCancel,
}: {
  regionCodes: string[]
  imageUrl: string
  initialPlacement?: PhotoPlacement
  onConfirm: (placement: PhotoPlacement) => void
  onCancel: () => void
}) {
  const [regions, setRegions] = useState<RegionFeature[] | null>(null)
  const [placement, setPlacement] = useState<PhotoPlacement>(initialPlacement ?? { scale: 1, x: 0, y: 0, rotation: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ mode: 'pan'; x: number; y: number } | { mode: 'pinch'; distance: number; angle: number } | null>(
    null,
  )

  useEffect(() => {
    loadRegions().then((collection) =>
      setRegions(collection.features.filter((f) => regionCodes.includes(f.properties.region_code))),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!regions) return null

  const selectedCollection = { type: 'FeatureCollection' as const, features: regions }
  const projection = geoMercator().fitSize([EDITOR_SIZE, EDITOR_SIZE], selectedCollection)
  const pathGenerator = geoPath(projection)
  const { cx, cy, bw, bh, side } = boundsOf(pathGenerator, regions)
  const imageTransform = imageTransformOf({ cx, cy, bw, bh }, placement)
  const clipId = 'diary-photo-editor-clip'

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current = null
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]

    if (pts.length === 1) {
      const [p] = pts
      const prev = gesture.current
      if (prev?.mode === 'pan') {
        setPlacement((cur) => ({ ...cur, x: cur.x + (p.x - prev.x) / bw, y: cur.y + (p.y - prev.y) / bh }))
      }
      gesture.current = { mode: 'pan', x: p.x, y: p.y }
    } else if (pts.length === 2) {
      const [a, b] = pts
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      const prev = gesture.current
      if (prev?.mode === 'pinch') {
        const scaleDelta = distance / prev.distance
        const rotationDelta = angle - prev.angle
        setPlacement((cur) => ({
          ...cur,
          scale: Math.min(6, Math.max(0.2, cur.scale * scaleDelta)),
          rotation: cur.rotation + rotationDelta,
        }))
      }
      gesture.current = { mode: 'pinch', distance, angle }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    gesture.current = null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    setPlacement((cur) => ({ ...cur, scale: Math.min(6, Math.max(0.2, cur.scale * delta)) }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/40 px-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="touch-none overflow-hidden rounded-md border border-line bg-region-empty"
        style={{ width: EDITOR_SIZE, height: EDITOR_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg viewBox={`0 0 ${EDITOR_SIZE} ${EDITOR_SIZE}`} className="h-full w-full">
          <defs>
            <clipPath id={clipId}>
              {regions.map((f) => (
                <path key={f.properties.region_code} d={pathGenerator(f) ?? undefined} />
              ))}
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <g transform={imageTransform}>
              <image
                href={imageUrl}
                x={cx - side / 2}
                y={cy - side / 2}
                width={side}
                height={side}
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
          </g>

          <g fill="none" stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth={1.5}>
            {regions.map((f) => (
              <path key={f.properties.region_code} d={pathGenerator(f) ?? undefined} />
            ))}
          </g>
        </svg>
      </div>

      <p className="text-xs text-muted">드래그로 이동, 휠 또는 두 손가락으로 확대·축소·회전</p>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="rounded-sm border border-line px-4 py-2 text-sm text-ink">
          취소
        </button>
        <button
          type="button"
          onClick={() => onConfirm(placement)}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          이 위치로 저장
        </button>
      </div>
    </div>
  )
}
