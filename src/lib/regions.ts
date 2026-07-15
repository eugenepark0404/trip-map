import type { Feature, FeatureCollection, Geometry } from 'geojson'

export type RegionProperties = {
  region_code: string
  name: string
  province_code: string
}

export type RegionFeature = Feature<Geometry, RegionProperties>
export type RegionCollection = FeatureCollection<Geometry, RegionProperties>

export type ProvinceProperties = {
  province_code: string
  name: string
}

export type ProvinceFeature = Feature<Geometry, ProvinceProperties>
export type ProvinceCollection = FeatureCollection<Geometry, ProvinceProperties>

export const PROVINCE_NAMES: Record<string, string> = {
  '11': '서울특별시',
  '26': '부산광역시',
  '27': '대구광역시',
  '28': '인천광역시',
  '30': '대전광역시',
  '31': '울산광역시',
  '36': '세종특별자치시',
  '41': '경기도',
  '43': '충청북도',
  '44': '충청남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주특별자치도',
  '51': '강원특별자치도',
  '52': '전북특별자치도',
  gwangju: '광주광역시',
  jeonnam: '전라남도',
}

let cache: Promise<RegionCollection> | null = null

export function loadRegions(): Promise<RegionCollection> {
  if (!cache) {
    cache = fetch('/regions.geojson').then((res) => {
      if (!res.ok) throw new Error('지역 경계 데이터를 불러오지 못했습니다.')
      return res.json()
    })
  }
  return cache
}

let provinceCache: Promise<ProvinceCollection> | null = null

export function loadProvinces(): Promise<ProvinceCollection> {
  if (!provinceCache) {
    provinceCache = fetch('/provinces.geojson').then((res) => {
      if (!res.ok) throw new Error('시도 경계 데이터를 불러오지 못했습니다.')
      return res.json()
    })
  }
  return provinceCache
}

// "안산시단원구" -> "단원구": on-map labels for split-city districts show just the district part.
export function shortLabel(name: string): string {
  const match = name.match(/^(.+시)(.+구)$/)
  return match ? match[2] : name
}

export function groupByProvince(collection: RegionCollection): Map<string, RegionFeature[]> {
  const groups = new Map<string, RegionFeature[]>()
  for (const feature of collection.features) {
    const code = feature.properties.province_code
    if (!groups.has(code)) groups.set(code, [])
    groups.get(code)!.push(feature)
  }
  return groups
}
