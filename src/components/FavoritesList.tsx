import { useEffect, useState } from 'react'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { loadRegions } from '../lib/regions'

type FavoriteRegion = { regionCode: string; name: string }

export function FavoritesList({ onSelectRegion }: { onSelectRegion: (regionCode: string) => void }) {
  const { currentMapId } = useMaps()
  const [favorites, setFavorites] = useState<FavoriteRegion[] | null>(null)

  async function load() {
    if (!currentMapId) {
      setFavorites([])
      return
    }
    const [{ data: favRows }, regions] = await Promise.all([
      supabase.from('favorites').select('region_code').eq('map_id', currentMapId),
      loadRegions(),
    ])
    const nameByCode = new Map(regions.features.map((f) => [f.properties.region_code, f.properties.name]))
    setFavorites((favRows ?? []).map((row) => ({ regionCode: row.region_code, name: nameByCode.get(row.region_code) ?? row.region_code })))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMapId])

  async function removeFavorite(regionCode: string) {
    if (!currentMapId) return
    setFavorites((prev) => prev?.filter((f) => f.regionCode !== regionCode) ?? null)
    await supabase.from('favorites').delete().eq('map_id', currentMapId).eq('region_code', regionCode)
  }

  if (favorites === null) return null

  if (favorites.length === 0) {
    return <p className="text-sm text-muted">즐겨찾기한 장소가 없습니다.</p>
  }

  return (
    <ul className="flex flex-col gap-1">
      {favorites.map((fav) => (
        <li key={fav.regionCode} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectRegion(fav.regionCode)}
            className="flex-1 rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-region-empty"
          >
            {fav.name}
          </button>
          <button
            type="button"
            onClick={() => removeFavorite(fav.regionCode)}
            aria-label={`${fav.name} 즐겨찾기 해제`}
            className="px-1 text-xs text-muted underline underline-offset-2"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>
  )
}
