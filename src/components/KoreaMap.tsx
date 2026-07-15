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
import { loadRivers, type RiverCollection } from '../lib/rivers'
import { boundsOf, imageTransformOf } from '../lib/photoPlacement'
import { useDiaries } from '../context/DiaryContext'

const VIEW_WIDTH = 800
const VIEW_HEIGHT = 960

// labels only appear once zoomed in past this scale (otherwise the whole-country view gets
// cluttered), and every visible label shares the same on-screen size — sized from the current
// zoom scale alone, not each region's own area, so the map doesn't mix huge and tiny text at once.
const LABEL_MIN_SCALE = 3
const LABEL_FONT_PX = 13

// 독도 sits ~1.9 degrees further east than the rest of the country. fitting the projection to
// the full extent would leave most of the map as empty ocean, so the initial view is fit to the
// mainland + Jeju instead; 독도 is still real data (its own region, split out from 울릉군 in
// scripts/build-regions.mjs) and reachable by panning, just outside the default viewport.
const MAX_FIT_LONGITUDE = 130.95

// extra breathing room around the fitted content so edge territories (울릉도, 백령도 등) aren't
// pinned right against the pannable area's boundary — without this, panning stops exactly at
// their coastline, making them awkward to reach and to tap near the container edge.
const FIT_PADDING_RATIO = 0.1

function fitExtent(regions: RegionCollection): Polygon {
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(regions)
  const clampedMaxLon = Math.min(maxLon, MAX_FIT_LONGITUDE)
  const lonPad = (clampedMaxLon - minLon) * FIT_PADDING_RATIO
  const latPad = (maxLat - minLat) * FIT_PADDING_RATIO
  const [paddedMinLon, paddedMaxLon] = [minLon - lonPad, clampedMaxLon + lonPad]
  const [paddedMinLat, paddedMaxLat] = [minLat - latPad, maxLat + latPad]
  // ring must wind clockwise (in plain lon=x/lat=y terms) or d3-geo reads it as covering the
  // entire globe instead of just this box — see the matching note in scripts/build-regions.mjs.
  return {
    type: 'Polygon',
    coordinates: [
      [
        [paddedMinLon, paddedMinLat],
        [paddedMinLon, paddedMaxLat],
        [paddedMaxLon, paddedMaxLat],
        [paddedMaxLon, paddedMinLat],
        [paddedMinLon, paddedMinLat],
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
    const [rivers, setRivers] = useState<RiverCollection | null>(null)
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
      loadRivers()
        .then(setRivers)
        .catch((err) => console.error('하천 데이터 로드 실패', err))
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

    // label position per region — memoized since it only depends on the geometry, not the scale.
    const labelInfo = useMemo(() => {
      if (!regions || !pathGenerator) return new Map<string, { x: number; y: number }>()
      const map = new Map<string, { x: number; y: number }>()
      for (const feature of regions.features) {
        const [x, y] = pathGenerator.centroid(feature)
        if (Number.isNaN(x) || Number.isNaN(y)) continue
        map.set(feature.properties.region_code, { x, y })
      }
      return map
    }, [regions, pathGenerator])

    // regions whose representative photo already fills the shape don't need a label on top of it
    const photoCoveredRegions = useMemo(() => {
      const codes = new Set<string>()
      for (const diary of diaries) {
        const rep = diary.photos.find((p) => p.isRepresentative && p.placement)
        if (!rep || !photoUrls.get(diary.id)) continue
        for (const code of diary.regionCodes) codes.add(code)
      }
      return codes
    }, [diaries, photoUrls])

    if (!regions || !provinces || !rivers || !pathGenerator) return null

    const byCode = new Map(regions.features.map((f) => [f.properties.region_code, f]))

    return (
      <TransformWrapper
        ref={transformRef}
        minScale={1}
        maxScale={40}
        initialScale={1}
        centerOnInit
        doubleClick={{ disabled: true }}
        onTransform={(_ref, state) => setScale(state.scale)}
      >
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full">
            {regions.features.map((feature) => (
              <path
                key={feature.properties.region_code}
                id={`region-${feature.properties.region_code}`}
                d={pathGenerator(feature) ?? undefined}
                onDoubleClick={() => onRegionTap(feature.properties.region_code)}
                className={
                  regionToDiary.has(feature.properties.region_code)
                    ? 'fill-region-filled stroke-region-stroke transition-colors'
                    : 'fill-region-empty stroke-region-stroke transition-colors'
                }
                strokeWidth={0.25}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <g fill="none" className="stroke-river" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke">
              {rivers.features.map((feature, i) => (
                <path key={i} d={pathGenerator(feature) ?? undefined} />
              ))}
            </g>

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
                const code = feature.properties.region_code
                // 독도 always keeps its label — real-world importance aside, its landmass is tiny
                // enough that without a permanent label it'd be nearly impossible to find by panning.
                if (code !== 'dokdo' && scale < LABEL_MIN_SCALE) return null
                if (photoCoveredRegions.has(code)) return null
                const info = labelInfo.get(code)
                if (!info) return null
                return (
                  <text key={code} x={info.x} y={info.y} fontSize={LABEL_FONT_PX / scale}>
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
