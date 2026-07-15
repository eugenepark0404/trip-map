// assembles public/regions.geojson: mixed-granularity Korean administrative boundaries.
//
// source: vuski/admdongkor HangJeongDong (행정동) boundaries — actively maintained, WGS84.
// bump SOURCE_VERSION below to pick up a newer snapshot (folder names are dates, e.g. ver20260701).
// https://github.com/vuski/admdongkor
//
// the source is 행정동-level for the whole country. we dissolve emd features up to the
// granularity each region of the app needs:
// - everywhere except a few named islands (below): dissolve to 시군구 (sgg) level — this
//   naturally includes the 자치구 of every metro city (Seoul/Busan/Daegu/Incheon/Daejeon/Ulsan/
//   Gwangju), since a metro's gu/gun are themselves sgg-level units. Sejong has no gu layer in
//   the source (a single sgg covering all of its 읍면동), so it comes out as one polygon
//   regardless. Jeju is just its 2 시 (제주시/서귀포시) — 읍면동 level was tried and turned out
//   too fragmented for this app's purposes.
// - Gwangju: as of this source, Gwangju's sido code is merged with Jeollanam-do
//   ("전남광주통합특별시"). Gwangju's original 5 자치구 (동구/서구/남구/북구/광산구) are
//   identified by name and grouped under a separate 'gwangju' province_code so the app's
//   "찾기" hierarchy still lists Gwangju and Jeonnam as separate provinces.
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'regions.geojson')

const SOURCE_VERSION = 'ver20260701'
const SOURCE_URL = `https://raw.githubusercontent.com/vuski/admdongkor/master/${SOURCE_VERSION}/HangJeongDong_${SOURCE_VERSION}.geojson`

const GWANGJU_IN_JEONNAM_SIDO = '12'
const GWANGJU_GU_NAMES = new Set(['동구', '서구', '남구', '북구', '광산구'])

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

    const provinceCode =
      sido === GWANGJU_IN_JEONNAM_SIDO ? (GWANGJU_GU_NAMES.has(sggnm) ? 'gwangju' : 'jeonnam') : sido

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

  // turf.union's output winds exterior rings the opposite way d3-geo expects (the source data's
  // own winding is already correct — this only matters for dissolved features, but rewinding
  // everything is a harmless no-op on the rest). Without this, d3.geoBounds/geoPath silently
  // misreads a dissolved polygon as covering the whole globe instead of just that region.
  const rewound = turf.rewind(turf.featureCollection(output), { reverse: true, mutate: true })

  // the source is full-resolution; simplify or this file is ~12MB
  const simplified = turf.simplify(rewound, { tolerance: 0.004, highQuality: false, mutate: true })

  writeFileSync(outPath, JSON.stringify(simplified))

  const bbox = turf.bbox(simplified)
  console.log(`regions: ${output.length} features (source ${SOURCE_VERSION})`)
  console.log(`bbox: [${bbox.join(', ')}]`)
  console.log(`wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
