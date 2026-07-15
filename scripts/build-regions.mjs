// assembles public/regions.geojson: mixed-granularity Korean administrative boundaries.
//
// source: vuski/admdongkor HangJeongDong (행정동) boundaries — actively maintained, WGS84.
// bump SOURCE_VERSION below to pick up a newer snapshot (folder names are dates, e.g. ver20260701).
// https://github.com/vuski/admdongkor
//
// the source is 행정동-level for the whole country. we dissolve emd features up to the
// granularity each region of the app needs:
// - Seoul / Incheon: dissolve to 시군구 (sgg) level, i.e. their 자치구 — the only two places that
//   keep gu-level detail.
// - Everywhere else (Gyeonggi / Gangwon / Chungbuk / Chungnam / Jeonbuk / Jeonnam / Gyeongbuk /
//   Gyeongnam): normal 시/군 stay as their own sgg, but any city internally split into 자치구
//   (수원시장안구, 전주시완산구, 청주시상당구, 천안시동남구, 포항시남구, 창원시의창구, …) is
//   dissolved back into a single polygon for the whole city, detected by the "OO시OO구" naming
//   pattern in the source and merged by that city-name prefix.
// - Busan / Daegu / Daejeon / Ulsan / Gwangju: dissolved into a single polygon per city — no
//   자치구-level breakdown for these either. Sejong has no gu layer in the source at all (a single
//   sgg covering all of its 읍면동), so it's already one polygon regardless.
// - Gwangju: as of this source, Gwangju's sido code is merged with Jeollanam-do
//   ("전남광주통합특별시"). Gwangju's original 5 자치구 (동구/서구/남구/북구/광산구) are
//   identified by name and dissolved into one "광주광역시" polygon; the other 22 시/군 stay at
//   sgg level under 전라남도.
// - Jeju is just its 2 시 (제주시/서귀포시) — 읍면동 level was tried and turned out too
//   fragmented for this app's purposes.
// - named islands (백령도/연평도/대부도/독도): pulled out of their parent 시군구 as their own
//   region rather than folded into the mainland county's polygon, since they're a separate trip
//   destination in practice. 백령도/연평도/대부도 already have their own 행정동 code in the
//   source (each is exactly one 면/동), so this is just "don't group it with its sgg siblings".
//   독도 has no 행정동 code of its own — administratively it's part of 울릉읍 — but its
//   MultiPolygon geometry contains disconnected pieces far to the east (Dokdo's two islets, ~90km
//   from the rest of Ulleung-eup), which we split out by longitude before 울릉읍 joins the
//   normal 울릉군 dissolve. 강화도/울릉도 already get their own boundary as-is (강화군/울릉군
//   are each already a single sgg), so no extra handling is needed for those two.
//
// each output feature carries { region_code, name, province_code } — province_code drives the
// "찾기" hierarchy (src/lib/regions.ts) and is set explicitly here rather than derived from
// region_code, since the Gwangju/Jeonnam split above can't be recovered from the code alone.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as turf from '@turf/turf'
import { topology } from 'topojson-server'
import { presimplify, simplify, quantile, filter as topoFilter } from 'topojson-simplify'
import { feature as topoFeature } from 'topojson-client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'regions.geojson')
const provincesOutPath = join(__dirname, '..', 'public', 'provinces.geojson')

// must match PROVINCE_NAMES in src/lib/regions.ts
const PROVINCE_NAMES = {
  11: '서울특별시',
  26: '부산광역시',
  27: '대구광역시',
  28: '인천광역시',
  30: '대전광역시',
  31: '울산광역시',
  36: '세종특별자치시',
  41: '경기도',
  43: '충청북도',
  44: '충청남도',
  47: '경상북도',
  48: '경상남도',
  50: '제주특별자치도',
  51: '강원특별자치도',
  52: '전북특별자치도',
  gwangju: '광주광역시',
  jeonnam: '전라남도',
}

const SOURCE_VERSION = 'ver20260701'
const SOURCE_URL = `https://raw.githubusercontent.com/vuski/admdongkor/master/${SOURCE_VERSION}/HangJeongDong_${SOURCE_VERSION}.geojson`

const GWANGJU_IN_JEONNAM_SIDO = '12'
const GWANGJU_GU_NAMES = new Set(['동구', '서구', '남구', '북구', '광산구'])

// metro cities dissolved into a single polygon (no 자치구 breakdown) — everything else keeps
// its 시군구/자치구 level. Gwangju is handled separately since its sido is shared with Jeonnam.
const METRO_DISSOLVE_SIDOS = new Set(['26', '27', '30', '31'])

// only Seoul and Incheon keep 자치구-level detail for cities that are internally split into
// districts (수원시장안구 등); everywhere else, e.g. 수원시/전주시/청주시/천안시/포항시/창원시,
// those districts get dissolved back into one polygon for the whole city.
const KEEP_GU_SPLIT_SIDOS = new Set(['11', '28'])
const SPLIT_CITY_NAME = /^(.+시)(.+구)$/

// adm_cd2 -> display name, for emd that should stand alone instead of joining their sgg's dissolve
const ISLAND_EMD_OVERRIDES = {
  '2872033000': '백령도', // 옹진군 백령면
  '2872038000': '연평도', // 옹진군 연평면
  '4127361000': '대부도', // 안산시단원구 대부동
}

const ULLEUNG_EUP_CODE = '4794025000'
const DOKDO_LONGITUDE_THRESHOLD = 131.5 // Dokdo's islets sit ~90km east of the rest of 울릉읍

function regionFeature(geometry, props) {
  return turf.feature(geometry, props)
}

function dissolveGroup(features) {
  if (features.length === 1) return features[0].geometry
  const merged = turf.union(turf.featureCollection(features.map((f) => turf.feature(f.geometry))))
  return merged.geometry
}

// splits 울릉읍's MultiPolygon into { mainland, dokdo } by longitude, since Dokdo has no 행정동
// code of its own in the source.
function splitDokdoFromUlleungEup(feature) {
  const parts = feature.geometry.coordinates // MultiPolygon: array of Polygon coordinate arrays
  const mainlandParts = []
  const dokdoParts = []
  for (const part of parts) {
    const [lon] = part[0][0] // first coordinate of the exterior ring
    ;(lon > DOKDO_LONGITUDE_THRESHOLD ? dokdoParts : mainlandParts).push(part)
  }
  return {
    mainland: { type: 'MultiPolygon', coordinates: mainlandParts },
    dokdo: { type: 'MultiPolygon', coordinates: dokdoParts },
  }
}

async function main() {
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`${SOURCE_URL} -> ${res.status}`)
  const source = await res.json()

  const output = []
  const sggGroups = new Map() // sgg code -> { name, province_code, features }
  const cityGroups = new Map() // "sido:cityName" -> { name, regionCode, province_code, features }
  const metroGroups = new Map() // sido code -> features
  const gwangjuFeatures = []

  for (const f of source.features) {
    const { sido, sgg, sggnm } = f.properties

    if (ISLAND_EMD_OVERRIDES[f.properties.adm_cd2]) {
      output.push(
        regionFeature(f.geometry, {
          region_code: f.properties.adm_cd2,
          name: ISLAND_EMD_OVERRIDES[f.properties.adm_cd2],
          province_code: sido,
        }),
      )
      continue
    }

    let geometry = f.geometry
    if (f.properties.adm_cd2 === ULLEUNG_EUP_CODE) {
      const { mainland, dokdo } = splitDokdoFromUlleungEup(f)
      geometry = mainland
      output.push(regionFeature(dokdo, { region_code: 'dokdo', name: '독도', province_code: sido }))
    }

    if (sido === GWANGJU_IN_JEONNAM_SIDO && GWANGJU_GU_NAMES.has(sggnm)) {
      gwangjuFeatures.push({ geometry })
      continue
    }

    if (METRO_DISSOLVE_SIDOS.has(sido)) {
      if (!metroGroups.has(sido)) metroGroups.set(sido, [])
      metroGroups.get(sido).push({ geometry })
      continue
    }

    const provinceCode = sido === GWANGJU_IN_JEONNAM_SIDO ? 'jeonnam' : sido
    const splitCityMatch = !KEEP_GU_SPLIT_SIDOS.has(sido) && sggnm.match(SPLIT_CITY_NAME)

    if (splitCityMatch) {
      const cityName = splitCityMatch[1]
      const key = `${sido}:${cityName}`
      if (!cityGroups.has(key)) cityGroups.set(key, { name: cityName, regionCode: sgg, provinceCode, features: [] })
      cityGroups.get(key).features.push({ geometry })
      continue
    }

    if (!sggGroups.has(sgg)) sggGroups.set(sgg, { name: sggnm, provinceCode, features: [] })
    sggGroups.get(sgg).features.push({ geometry })
  }

  for (const [sgg, group] of sggGroups) {
    output.push(
      regionFeature(dissolveGroup(group.features), {
        region_code: sgg,
        name: group.name,
        province_code: group.provinceCode,
      }),
    )
  }

  for (const group of cityGroups.values()) {
    output.push(
      regionFeature(dissolveGroup(group.features), {
        region_code: group.regionCode,
        name: group.name,
        province_code: group.provinceCode,
      }),
    )
  }

  for (const [sido, features] of metroGroups) {
    output.push(
      regionFeature(dissolveGroup(features), {
        region_code: `metro-${sido}`,
        name: PROVINCE_NAMES[sido],
        province_code: sido,
      }),
    )
  }

  output.push(
    regionFeature(dissolveGroup(gwangjuFeatures), {
      region_code: 'metro-gwangju',
      name: '광주광역시',
      province_code: 'gwangju',
    }),
  )

  // province-level (시도) outlines, for a thicker boundary drawn over the regular thin ones —
  // dissolved from the same regions above rather than the raw source, so it lines up exactly.
  const provinceGroups = new Map() // province_code -> features
  for (const feature of output) {
    const code = feature.properties.province_code
    if (!provinceGroups.has(code)) provinceGroups.set(code, [])
    provinceGroups.get(code).push(feature)
  }
  const provinceOutput = [...provinceGroups.entries()].map(([code, features]) =>
    regionFeature(dissolveGroup(features), { province_code: code, name: PROVINCE_NAMES[code] ?? code }),
  )

  // union() occasionally leaves tiny interior-ring artifacts where adjacent source polygons
  // didn't tile perfectly (they render as a stray thin loop "floating" inside the shape) — none
  // of these regions should legitimately have a hole, so drop every interior ring outright.
  // building one shared topology across regions + provinces (instead of simplifying each
  // FeatureCollection separately with turf.simplify) means their common borders are simplified
  // identically, so adjacent shapes stay seamless instead of drifting apart into gap/overlap
  // slivers.
  let topo = topology({ regions: turf.featureCollection(output), provinces: turf.featureCollection(provinceOutput) })
  topo = topoFilter(topo, (_ring, interior) => !interior)
  topo = presimplify(topo)
  topo = simplify(topo, quantile(topo, 0.15))

  const regionsGeo = topoFeature(topo, topo.objects.regions)
  const provincesGeo = topoFeature(topo, topo.objects.provinces)

  // topojson uses the shapefile winding convention (opposite of GeoJSON's RFC 7946), which is
  // also what our dissolved features end up in — but d3-geo expects clockwise exteriors in plain
  // lon/lat terms, so this still needs the same rewind as before (see note above).
  const rewound = turf.rewind(regionsGeo, { reverse: true, mutate: true })
  const provincesRewound = turf.rewind(provincesGeo, { reverse: true, mutate: true })

  // presimplify/simplify drop topojson's integer delta-encoding, leaving long float coordinates —
  // round back down to ~1m precision or the JSON text balloons regardless of point count.
  const truncated = turf.truncate(rewound, { precision: 5, mutate: true })
  const provincesTruncated = turf.truncate(provincesRewound, { precision: 5, mutate: true })

  writeFileSync(outPath, JSON.stringify(truncated))
  writeFileSync(provincesOutPath, JSON.stringify(provincesTruncated))

  const bbox = turf.bbox(rewound)
  console.log(`regions: ${output.length} features (source ${SOURCE_VERSION})`)
  console.log(`provinces: ${provinceOutput.length} features`)
  console.log(`bbox: [${bbox.join(', ')}]`)
  console.log(`wrote ${outPath}`)
  console.log(`wrote ${provincesOutPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
