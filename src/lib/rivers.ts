import type { FeatureCollection, Geometry } from 'geojson'

export type RiverCollection = FeatureCollection<Geometry, { name: string }>

let cache: Promise<RiverCollection> | null = null

export function loadRivers(): Promise<RiverCollection> {
  if (!cache) {
    cache = fetch('/rivers.geojson').then((res) => {
      if (!res.ok) throw new Error('하천 데이터를 불러오지 못했습니다.')
      return res.json()
    })
  }
  return cache
}
