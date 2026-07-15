// assembles public/rivers.geojson: major rivers wide/long enough to read meaningfully on the
// national map, rendered as light-blue lines on top of the region fills.
//
// source: OpenStreetMap via the public Overpass API (waterway=river ways, by name within a
// bounding box covering that river's full course). The public instance is shared and often
// slow/rate-limited, so requests retry with backoff and run one river at a time.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as turf from '@turf/turf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'public', 'rivers.geojson')

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: '*/*',
  'User-Agent': 'trip-map-build-rivers/1.0 (+https://github.com)',
}

// [name, south, west, north, east] — bounding box wide enough to cover the river's full course
const RIVERS = [
  ['한강', 37.4, 126.5, 37.9, 127.9],
  ['남한강', 36.85, 127.3, 37.55, 128.05],
  ['북한강', 37.4, 127.2, 38.3, 128.1],
  ['동강', 37.1, 128.35, 37.35, 128.75],
  ['섬진강', 34.9, 127.05, 35.6, 127.85],
  ['낙동강', 35.0, 128.0, 37.0, 129.1],
  ['금강', 35.9, 126.9, 36.6, 127.8],
  ['영산강', 34.7, 126.3, 35.5, 127.1],
]

async function overpass(query, attempt = 1) {
  const res = await fetch(OVERPASS_URL, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: HEADERS })
  const text = await res.text()
  if (!res.ok) {
    if (attempt <= 5) {
      const wait = 8000 * attempt
      console.log(`  ${res.status}, retrying in ${wait}ms (attempt ${attempt})`)
      await new Promise((r) => setTimeout(r, wait))
      return overpass(query, attempt + 1)
    }
    throw new Error(`overpass ${res.status}: ${text.slice(0, 300)}`)
  }
  return JSON.parse(text)
}

function waysToFeatures(elements, name) {
  return elements
    .filter((el) => el.type === 'way' && el.geometry)
    .map((el) => ({
      type: 'Feature',
      properties: { name },
      geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [p.lon, p.lat]) },
    }))
}

async function main() {
  const output = []
  for (const [name, south, west, north, east] of RIVERS) {
    console.log('fetching', name)
    const q = `[out:json][timeout:90];way["waterway"="river"]["name"="${name}"](${south},${west},${north},${east});out geom;`
    const json = await overpass(q)
    const features = waysToFeatures(json.elements, name)
    console.log(`  ${features.length} segments`)
    output.push(...features)
    await new Promise((r) => setTimeout(r, 3000))
  }

  const collection = turf.featureCollection(output)
  const simplified = turf.simplify(collection, { tolerance: 0.001, highQuality: false, mutate: true })

  writeFileSync(outPath, JSON.stringify(simplified))
  console.log(`wrote ${outPath} (${output.length} segments across ${RIVERS.length} rivers)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
