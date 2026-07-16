import { useEffect, useState } from 'react'
import { useDiaries } from '../context/DiaryContext'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { loadRegions } from '../lib/regions'
import { DiaryForm } from './DiaryForm'
import { BucketNoteForm } from './BucketNoteForm'
import type { BucketItem, Diary } from '../lib/types'

type BucketRow = { id: string; map_id: string; region_code: string | null; title: string; memo: string | null }

export function RegionDiaryPanel({ regionCode, onClose }: { regionCode: string; onClose: () => void }) {
  const { currentMapId } = useMaps()
  const { regionToDiary } = useDiaries()
  const [regionName, setRegionName] = useState(regionCode)
  const [editingDiary, setEditingDiary] = useState<Diary | 'new' | null>(null)
  const [editingBucketItem, setEditingBucketItem] = useState<BucketItem | 'new' | null>(null)
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadRegions().then((collection) => {
      const feature = collection.features.find((f) => f.properties.region_code === regionCode)
      if (feature) setRegionName(feature.properties.name)
    })
  }, [regionCode])

  async function loadBucketItems() {
    if (!currentMapId) return
    const { data, error } = await supabase
      .from('bucket_items')
      .select('id, map_id, region_code, title, memo')
      .eq('map_id', currentMapId)
      .eq('region_code', regionCode)
    if (error) {
      console.error('버킷일지 조회 실패', error)
      return
    }
    setBucketItems(
      ((data ?? []) as BucketRow[]).map((row) => ({
        id: row.id,
        mapId: row.map_id,
        regionCode: row.region_code,
        title: row.title,
        memo: row.memo,
      })),
    )
  }

  useEffect(() => {
    loadBucketItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMapId, regionCode])

  const diaries = regionToDiary.get(regionCode) ?? []

  if (editingDiary) {
    return (
      <DiaryForm
        regionCode={regionCode}
        diary={editingDiary === 'new' ? undefined : editingDiary}
        onClose={() => setEditingDiary(null)}
      />
    )
  }

  if (editingBucketItem) {
    return (
      <BucketNoteForm
        regionCode={regionCode}
        item={editingBucketItem === 'new' ? undefined : editingBucketItem}
        onSaved={loadBucketItems}
        onClose={() => setEditingBucketItem(null)}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center"
      onClick={() => {
        setExpanded(false)
        onClose()
      }}
    >
      <div
        className="relative max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-md border border-line bg-bg p-5 pb-20 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">{regionName}</h2>
        </div>

        {diaries.length === 0 && bucketItems.length === 0 ? (
          <p className="text-sm text-muted">아직 작성한 다이어리가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {diaries.map((diary) => (
              <li key={diary.id}>
                <button
                  type="button"
                  onClick={() => setEditingDiary(diary)}
                  className="w-full rounded-sm border border-line px-3 py-2 text-left text-sm hover:bg-region-empty"
                >
                  <p className="text-ink">{diary.date}</p>
                  {diary.body && <p className="mt-0.5 truncate text-xs text-muted">{diary.body}</p>}
                </button>
              </li>
            ))}
            {bucketItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setEditingBucketItem(item)}
                  className="w-full rounded-sm border border-line px-3 py-2 text-left text-sm hover:bg-region-empty"
                >
                  <p className="text-ink">
                    <span className="mr-1 text-xs text-muted">버킷일지</span>
                    {item.title}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
          <div
            className={`flex flex-col items-end gap-2 transition-all duration-200 ${
              expanded ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                setEditingBucketItem('new')
              }}
              className="whitespace-nowrap rounded-full border border-line bg-bg px-4 py-2 text-sm text-ink shadow-sm"
            >
              버킷일지 작성
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                setEditingDiary('new')
              }}
              className="whitespace-nowrap rounded-full border border-line bg-bg px-4 py-2 text-sm text-ink shadow-sm"
            >
              여행일지 작성
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label="새 항목 추가"
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg text-accent-ink transition-transform ${
              expanded ? 'rotate-45' : ''
            }`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
