// assembles public/regions.geojson: mixed-granularity Korean administrative boundaries.
//
// source: vuski/admdongkor HangJeongDong (행정동) boundaries — actively maintained, WGS84.
// bump SOURCE_VERSION below to pick up a newer snapshot (folder names are dates, e.g. ver20260701).
// https://github.com/vuski/admdongkor
//
// the source is 행정동-level for the whole country. we dissolve emd features up to the
// granularity each region of the app needs:
// - everywhere except Jeju: dissolve to 시군구 (sgg) level — this naturally includes the
//   자치구 of every metro city (Seoul/Busan/Daegu/Incheon/Daejeon/Ulsan/Gwangju), since a
//   metro's gu/gun are themselves sgg-level units. Sejong has no gu layer in the source
//   (a single sgg covering all of its 읍면동), so it comes out as one polygon regardless.
// - Gwangju: as of this source, Gwangju's sido code is merged with Jeollanam-do
//   ("전남광주통합특별시"). Gwangju's original 5 자치구 (동구/서구/남구/북구/광산구) are
//   identified by name and grouped under a separate 'gwangju' province_code so the app's
//   "찾기" hierarchy still lists Gwangju and Jeonnam as separate provinces.
// - Jeju: left at 읍면동 (emd) level, no dissolve.
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

const JEJU_SIDO = '50'
const GWANGJU_IN_JEONNAM_SIDO = '12'
const GWANGJU_GU_NAMES = new Set(['동구', '서구', '남구', '북구', '광산구'])

function regionFeature(geometry, props) {
  return turf.feature(geometry, props)
}

function dissolveGroup(features) {
  if (features.length === 1) return features[0].geometry
  const merged = turf.union(turf.featureCollection(features.map((f) => turf.feature(f.geometry))))
  return merged.geometry
}

async function main() {
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`${SOURCE_URL} -> ${res.status}`)
  const source = await res.json()

  const output = []
  const sggGroups = new Map() // sgg code -> { name, province_code, features }

  for (const f of source.features) {
    const { sido, sgg, sggnm } = f.properties

    if (sido === JEJU_SIDO) {
      output.push(
        regionFeature(f.geometry, {
          region_code: f.properties.adm_cd2,
          name: f.properties.adm_nm.split(' ').pop(),
          province_code: JEJU_SIDO,
        }),
      )
      continue
    }

    const provinceCode =
      sido === GWANGJU_IN_JEONNAM_SIDO ? (GWANGJU_GU_NAMES.has(sggnm) ? 'gwangju' : 'jeonnam') : sido

    if (!sggGroups.has(sgg)) sggGroups.set(sgg, { name: sggnm, provinceCode, features: [] })
    sggGroups.get(sgg).features.push(f)
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
