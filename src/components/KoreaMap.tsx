import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { geoBounds, geoMercator, geoPath } from 'd3-geo'
import type { Polygon } from 'geojson'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import {
  loadRegions,
  loadProvinces,
  shortLabel,
  type RegionCollection,
  type RegionFeature,
  type ProvinceCollection,
} from '../lib/regions'
import { boundsOf, imageTransformOf } from '../lib/photoPlacement'
import { useDiaries } from '../context/DiaryContext'

const VIEW_WIDTH = 800
const VIEW_HEIGHT = 960

// a region's label only appears once it's big enough on screen at the current zoom, and its
// font size is fixed relative to the region's own size — since both the shape and the label
// scale together with the surrounding pinch-zoom transform, that ratio (and so legibility) stays
// constant at any zoom level once it appears.
const LABEL_MIN_ON_SCREEN_SIZE = 26
const LABEL_FONT_RATIO = 0.22
const LABEL_FONT_MIN = 2
const LABEL_FONT_MAX = 11

// 독도 sits ~1.9 degrees further east than the rest of the country. fitting the projection to
// the full extent would leave most of the map as empty ocean, so the initial view is fit to the
// mainland + Jeju instead; 독도 is still real data (its own region, split out from 울릉군 in
// scripts/build-regions.mjs) and reachable by panning, just outside the default viewport.
const MAX_FIT_LONGITUDE = 130.95

function fitExtent(regions: RegionCollection): Polygon {
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(regions)
  const clampedMaxLon = Math.min(maxLon, MAX_FIT_LONGITUDE)
  // ring must wind clockwise (in plain lon=x/lat=y terms) or d3-geo reads it as covering the
  // entire globe instead of just this box — see the matching note in scripts/build-regions.mjs.
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [minLon, maxLat],
        [clampedMaxLon, maxLat],
        [clampedMaxLon, minLat],
        [minLon, minLat],
      ],
    ],
  }
}

export type KoreaMapHandle = {
  focusRegion: (regionCode: string) => void
}

export const KoreaMap = forwardRef<KoreaMapHandle, { onRegionTap: (regionCode: string) => void }>(
  ({ onRegionTap }, ref) => {
    const [regions, setRegions] = useState<RegionCollection | null>(null)
    const [provinces, setProvinces] = useState<ProvinceCollection | null>(null)
    const [scale, setScale] = useState(1)
    const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null)
    const { diaries, regionToDiary, photoUrls } = useDiaries()

    useEffect(() => {
      loadRegions()
        .then(setRegions)
        .catch((err) => console.error('지역 경계 로드 실패', err))
      loadProvinces()
        .then(setProvinces)
        .catch((err) => console.error('시도 경계 로드 실패', err))
    }, [])

    useImperativeHandle(ref, () => ({
      focusRegion(regionCode: string) {
        transformRef.current?.zoomToElement(`region-${regionCode}`, 3, 400)
      },
    }))

    const pathGenerator = useMemo(() => {
      if (!regions) return null
      const projection = geoMercator().fitSize([VIEW_WIDTH, VIEW_HEIGHT], fitExtent(regions))
      return geoPath(projection)
    }, [regions])

    // label position/size per region, fixed relative to that region's own geometry — computed
    // once (not on every zoom tick) since it doesn't depend on the current scale.
    const labelInfo = useMemo(() => {
      if (!regions || !pathGenerator) return new Map<string, { x: number; y: number; fontSize: number; minDim: number }>()
      const map = new Map<string, { x: number; y: number; fontSize: number; minDim: number }>()
      for (const feature of regions.features) {
        const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature)
        const minDim = Math.min(x1 - x0, y1 - y0)
        const [x, y] = pathGenerator.centroid(feature)
        if (Number.isNaN(x) || Number.isNaN(y)) continue
        const fontSize = Math.min(LABEL_FONT_MAX, Math.max(LABEL_FONT_MIN, minDim * LABEL_FONT_RATIO))
        map.set(feature.properties.region_code, { x, y, fontSize, minDim })
      }
      return map
    }, [regions, pathGenerator])

    if (!regions || !provinces || !pathGenerator) return null

    const byCode = new Map(regions.features.map((f) => [f.properties.region_code, f]))

    return (
      <TransformWrapper
        ref={transformRef}
        minScale={1}
        maxScale={40}
        initialScale={1}
        centerOnInit
        doubleClick={{ mode: 'zoomIn' }}
        onTransform={(_ref, state) => setScale(state.scale)}
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full">
            {regions.features.map((feature) => (
              <path
                key={feature.properties.region_code}
                id={`region-${feature.properties.region_code}`}
                d={pathGenerator(feature) ?? undefined}
                onClick={() => onRegionTap(feature.properties.region_code)}
                className={
                  regionToDiary.has(feature.properties.region_code)
                    ? 'fill-region-filled stroke-region-stroke transition-colors'
                    : 'fill-region-empty stroke-region-stroke transition-colors'
                }
                strokeWidth={0.25}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {diaries.map((diary) => {
              const rep = diary.photos.find((p) => p.isRepresentative && p.placement)
              const url = photoUrls.get(diary.id)
              if (!rep || !rep.placement || !url) return null

              const features = diary.regionCodes
                .map((code) => byCode.get(code))
                .filter((f): f is RegionFeature => f !== undefined)
              if (features.length === 0) return null

              const bounds = boundsOf(pathGenerator, features)
              const transform = imageTransformOf(bounds, rep.placement)
              const clipId = `diary-clip-${diary.id}`

              return (
                <g key={diary.id}>
                  <clipPath id={clipId}>
                    {features.map((f) => (
                      <path key={f.properties.region_code} d={pathGenerator(f) ?? undefined} />
                    ))}
                  </clipPath>
                  <g clipPath={`url(#${clipId})`}>
                    <g transform={transform}>
                      <image
                        href={url}
                        x={bounds.cx - bounds.side / 2}
                        y={bounds.cy - bounds.side / 2}
                        width={bounds.side}
                        height={bounds.side}
                        preserveAspectRatio="xMidYMid slice"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  </g>
                </g>
              )
            })}

            <g fill="none" className="stroke-province-stroke" strokeWidth={1.4} vectorEffect="non-scaling-stroke">
              {provinces.features.map((feature) => (
                <path key={feature.properties.province_code} d={pathGenerator(feature) ?? undefined} />
              ))}
            </g>

            <g className="fill-muted" style={{ pointerEvents: 'none' }} textAnchor="middle">
              {regions.features.map((feature) => {
                const info = labelInfo.get(feature.properties.region_code)
                if (!info || info.minDim * scale < LABEL_MIN_ON_SCREEN_SIZE) return null
                return (
                  <text key={feature.properties.region_code} x={info.x} y={info.y} fontSize={info.fontSize}>
                    {shortLabel(feature.properties.name)}
                  </text>
                )
              })}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>
    )
  },
)

KoreaMap.displayName = 'KoreaMap'
