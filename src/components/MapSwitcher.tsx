import { useState } from 'react'
import { useMaps } from '../context/MapContext'
import { CreateMapModal } from './CreateMapModal'

export function MapSwitcher({ onSelect }: { onSelect: () => void }) {
  const { maps, currentMapId, switchMap } = useMaps()
  const [creating, setCreating] = useState(false)

  return (
    <div className="relative flex h-full flex-col">
      <p className="mb-3 text-xs text-muted">지도 변경</p>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {maps.map((map) => (
          <li key={map.id}>
            <button
              type="button"
              onClick={async () => {
                await switchMap(map.id)
                onSelect()
              }}
              className={`w-full rounded-sm px-3 py-2 text-left text-sm ${
                map.id === currentMapId ? 'bg-region-filled text-ink' : 'text-ink hover:bg-region-empty'
              }`}
            >
              {map.name}
            </button>
          </li>
        ))}
        {maps.length === 0 && <li className="px-3 py-2 text-sm text-muted">아직 지도가 없습니다.</li>}
      </ul>

      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="지도 추가"
        className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg text-accent-ink"
      >
        +
      </button>

      {creating && <CreateMapModal onClose={() => setCreating(false)} />}
    </div>
  )
}
