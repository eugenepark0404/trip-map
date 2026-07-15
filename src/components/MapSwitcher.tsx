import { useState } from 'react'
import { useMaps } from '../context/MapContext'
import { CreateMapModal } from './CreateMapModal'

export function MapSwitcher({ onSelect }: { onSelect: () => void }) {
  const { maps, currentMapId, switchMap, toggleFavorite, deleteMap } = useMaps()
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(mapId: string, name: string) {
    if (!confirm(`"${name}" 지도를 삭제할까요? 지도 안의 모든 다이어리와 사진이 함께 삭제되며 되돌릴 수 없습니다.`)) return
    setDeletingId(mapId)
    try {
      await deleteMap(mapId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <p className="mb-3 text-xs text-muted">지도 변경</p>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {maps.map((map) => (
          <li key={map.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleFavorite(map.id)}
              aria-label={map.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              className={map.isFavorite ? 'text-accent' : 'text-line'}
            >
              ★
            </button>
            <button
              type="button"
              onClick={async () => {
                await switchMap(map.id)
                onSelect()
              }}
              className={`flex-1 rounded-sm px-3 py-2 text-left text-sm ${
                map.id === currentMapId ? 'bg-region-filled text-ink' : 'text-ink hover:bg-region-empty'
              }`}
            >
              {map.name}
            </button>
            {map.role === 'owner' && (
              <button
                type="button"
                onClick={() => handleDelete(map.id, map.name)}
                disabled={deletingId === map.id}
                className="px-2 text-xs text-muted underline underline-offset-2 disabled:opacity-50"
              >
                삭제
              </button>
            )}
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
