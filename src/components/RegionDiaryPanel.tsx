import { useEffect, useState } from 'react'
import { useDiaries } from '../context/DiaryContext'
import { loadRegions } from '../lib/regions'
import { DiaryForm } from './DiaryForm'
import type { Diary } from '../lib/types'

export function RegionDiaryPanel({ regionCode, onClose }: { regionCode: string; onClose: () => void }) {
  const { regionToDiary } = useDiaries()
  const [regionName, setRegionName] = useState(regionCode)
  const [editingDiary, setEditingDiary] = useState<Diary | 'new' | null>(null)

  useEffect(() => {
    loadRegions().then((collection) => {
      const feature = collection.features.find((f) => f.properties.region_code === regionCode)
      if (feature) setRegionName(feature.properties.name)
    })
  }, [regionCode])

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center" onClick={onClose}>
      <div
        className="relative max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-md border border-line bg-bg p-5 pb-20 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">{regionName}</h2>

        {diaries.length === 0 ? (
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
          </ul>
        )}

        <button
          type="button"
          onClick={() => setEditingDiary('new')}
          aria-label="새 다이어리 추가"
          className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-lg text-accent-ink"
        >
          +
        </button>
      </div>
    </div>
  )
}
