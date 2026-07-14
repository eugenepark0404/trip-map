import { useEffect, useState } from 'react'
import { loadRegions, type RegionFeature } from '../lib/regions'

export function RegionPicker({
  selectedCodes,
  onChange,
}: {
  selectedCodes: string[]
  onChange: (codes: string[]) => void
}) {
  const [allRegions, setAllRegions] = useState<RegionFeature[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadRegions().then((collection) => setAllRegions(collection.features))
  }, [])

  const byCode = new Map(allRegions.map((f) => [f.properties.region_code, f.properties.name]))

  const suggestions =
    query.trim().length > 0
      ? allRegions
          .filter((f) => f.properties.name.includes(query.trim()) && !selectedCodes.includes(f.properties.region_code))
          .slice(0, 6)
      : []

  function add(code: string) {
    onChange([...selectedCodes, code])
    setQuery('')
  }

  function remove(code: string) {
    onChange(selectedCodes.filter((c) => c !== code))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {selectedCodes.map((code) => (
          <span
            key={code}
            className="flex items-center gap-1 rounded-full border border-line bg-region-filled px-3 py-1 text-xs text-ink"
          >
            {byCode.get(code) ?? code}
            <button
              type="button"
              onClick={() => remove(code)}
              aria-label={`${byCode.get(code) ?? code} 제거`}
              className="text-muted"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative mt-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="지역 추가"
          className="w-full rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {suggestions.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-line bg-bg shadow-sm">
            {suggestions.map((f) => (
              <li key={f.properties.region_code}>
                <button
                  type="button"
                  onClick={() => add(f.properties.region_code)}
                  className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-region-empty"
                >
                  {f.properties.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
