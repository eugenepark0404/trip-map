import type { GeoPath } from 'd3-geo'
import type { RegionFeature } from './regions'
import type { PhotoPlacement } from './types'

// shared by PhotoPlacementEditor (authoring) and KoreaMap (final render), so a saved placement
// looks identical in both: {scale,x,y,rotation} on top of a base image centered on the region(s)
// bounding box, where x/y are fractions of the box size — resolution-independent regardless of
// which projection/zoom level is rendering it.
export function boundsOf(pathGenerator: GeoPath, features: RegionFeature[]) {
  const collection = { type: 'FeatureCollection' as const, features }
  const [[x0, y0], [x1, y1]] = pathGenerator.bounds(collection)
  const bw = x1 - x0
  const bh = y1 - y0
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, bw, bh, side: 1.8 * Math.max(bw, bh) }
}

export function imageTransformOf(
  bounds: { cx: number; cy: number; bw: number; bh: number },
  placement: PhotoPlacement,
) {
  const { cx, cy, bw, bh } = bounds
  const dx = placement.x * bw
  const dy = placement.y * bh
  return `translate(${cx + dx} ${cy + dy}) rotate(${placement.rotation}) scale(${placement.scale}) translate(${-cx} ${-cy})`
}
