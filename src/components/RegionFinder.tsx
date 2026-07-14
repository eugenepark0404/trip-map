import { useEffect, useState } from 'react'
import { loadRegions, groupByProvince, PROVINCE_NAMES, type RegionFeature } from '../lib/regions'

export function RegionFinder({
  onSelect,
  onClose,
}: {
  onSelect: (regionCode: string) => void
  onClose: () => void
}) {
  const [groups, setGroups] = useState<Map<string, RegionFeature[]> | null>(null)
  const [activeProvince, setActiveProvince] = useState<string | null>(null)

  useEffect(() => {
    loadRegions().then((collection) => setGroups(groupByProvince(collection)))
  }, [])

  const provinceCodes = groups ? [...groups.keys()].sort() : []
  const activeRegions = activeProvince && groups ? groups.get(activeProvince) ?? [] : []

  return (
    <div className="fixed inset-0 z-50 bg-ink/20" onClick={onClose}>
      <div
        className="absolute inset-x-3 top-16 flex max-h-[70vh] overflow-hidden rounded-md border border-line bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="w-1/2 overflow-y-auto border-r border-line">
          {provinceCodes.map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => setActiveProvince(code)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  activeProvince === code ? 'bg-region-filled text-ink' : 'text-ink hover:bg-region-empty'
                }`}
              >
                {PROVINCE_NAMES[code] ?? code}
              </button>
            </li>
          ))}
        </ul>
        <ul className="w-1/2 overflow-y-auto">
          {activeRegions
            .slice()
            .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'ko'))
            .map((feature) => (
              <li key={feature.properties.region_code}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(feature.properties.region_code)
                    onClose()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-region-empty"
                >
                  {feature.properties.name}
                </button>
              </li>
            ))}
          {activeProvince === null && (
            <li className="px-3 py-2 text-sm text-muted">왼쪽에서 지역을 선택하세요.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
