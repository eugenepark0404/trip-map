import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { geoBounds, geoMercator, geoPath } from 'd3-geo'
import type { Polygon } from 'geojson'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { loadRegions, type RegionCollection, type RegionFeature } from '../lib/regions'
import { boundsOf, imageTransformOf } from '../lib/photoPlacement'
import { useDiaries } from '../context/DiaryContext'

const VIEW_WIDTH = 800
const VIEW_HEIGHT = 960

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
    const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null)
    const { diaries, regionToDiary, photoUrls } = useDiaries()

    useEffect(() => {
      loadRegions()
        .then(setRegions)
        .catch((err) => console.error('지역 경계 로드 실패', err))
    }, [])

    useImperativeHandle(ref, () => ({
      focusRegion(regionCode: string) {
        transformRef.current?.zoomToElement(`region-${regionCode}`, 3, 400)
      },
    }))

    if (!regions) return null

    const projection = geoMercator().fitSize([VIEW_WIDTH, VIEW_HEIGHT], fitExtent(regions))
    const pathGenerator = geoPath(projection)
    const byCode = new Map(regions.features.map((f) => [f.properties.region_code, f]))

    return (
      <TransformWrapper
        ref={transformRef}
        minScale={1}
        maxScale={12}
        initialScale={1}
        centerOnInit
        doubleClick={{ mode: 'zoomIn' }}
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
                strokeWidth={0.4}
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
          </svg>
        </TransformComponent>
      </TransformWrapper>
    )
  },
)

KoreaMap.displayName = 'KoreaMap'
