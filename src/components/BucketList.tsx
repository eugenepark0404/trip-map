import { useEffect, useState } from 'react'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { loadRegions } from '../lib/regions'
import { BucketNoteForm } from './BucketNoteForm'
import type { BucketItem } from '../lib/types'

type BucketRow = { id: string; map_id: string; region_code: string | null; title: string; memo: string | null }

export function BucketList() {
  const { currentMapId } = useMaps()
  const [items, setItems] = useState<(BucketItem & { regionName: string })[] | null>(null)
  const [editingItem, setEditingItem] = useState<BucketItem | null>(null)

  async function load() {
    if (!currentMapId) {
      setItems([])
      return
    }
    const [{ data }, regions] = await Promise.all([
      supabase
        .from('bucket_items')
        .select('id, map_id, region_code, title, memo')
        .eq('map_id', currentMapId)
        .order('created_at', { ascending: false }),
      loadRegions(),
    ])
    const nameByCode = new Map(regions.features.map((f) => [f.properties.region_code, f.properties.name]))
    setItems(
      ((data ?? []) as BucketRow[]).map((row) => ({
        id: row.id,
        mapId: row.map_id,
        regionCode: row.region_code,
        title: row.title,
        memo: row.memo,
        regionName: row.region_code ? (nameByCode.get(row.region_code) ?? row.region_code) : '지역 없음',
      })),
    )
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMapId])

  if (items === null) return null

  if (items.length === 0) {
    return <p className="text-sm text-muted">등록한 버킷여행지가 없습니다.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setEditingItem(item)}
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-region-empty"
            >
              <span className="text-ink">{item.regionName}</span>
              <span className="ml-1 text-xs text-muted">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {editingItem && (
        <BucketNoteForm
          item={editingItem}
          onSaved={load}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  )
}
