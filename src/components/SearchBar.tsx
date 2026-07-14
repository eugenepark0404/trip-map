import { useEffect, useState } from 'react'
import { loadRegions, type RegionFeature } from '../lib/regions'
import { RegionFinder } from './RegionFinder'

export function SearchBar({ onSelectRegion }: { onSelectRegion: (regionCode: string) => void }) {
  const [allRegions, setAllRegions] = useState<RegionFeature[]>([])
  const [query, setQuery] = useState('')
  const [finderOpen, setFinderOpen] = useState(false)

  useEffect(() => {
    loadRegions().then((collection) => setAllRegions(collection.features))
  }, [])

  const suggestions =
    query.trim().length > 0
      ? allRegions.filter((f) => f.properties.name.includes(query.trim())).slice(0, 8)
      : []

  function select(regionCode: string) {
    onSelectRegion(regionCode)
    setQuery('')
  }

  return (
    <div className="fixed left-16 right-3 top-4 z-20">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지역 이름으로 검색"
            className="w-full rounded-full border border-line bg-bg/80 px-4 py-2 text-sm text-ink outline-none backdrop-blur-sm focus:border-accent"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-md border border-line bg-bg shadow-sm">
              {suggestions.map((f) => (
                <li key={f.properties.region_code}>
                  <button
                    type="button"
                    onClick={() => select(f.properties.region_code)}
                    className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-region-empty"
                  >
                    {f.properties.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          className="rounded-full border border-line bg-bg/80 px-4 py-2 text-sm text-ink backdrop-blur-sm"
        >
          찾기
        </button>
      </div>

      {finderOpen && <RegionFinder onSelect={select} onClose={() => setFinderOpen(false)} />}
    </div>
  )
}
