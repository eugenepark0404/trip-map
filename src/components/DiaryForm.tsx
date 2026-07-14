import { useState, type FormEvent } from 'react'
import { useDiaries } from '../context/DiaryContext'
import { RegionPicker } from './RegionPicker'
import { PhotoPlacementEditor } from './PhotoPlacementEditor'
import type { PhotoPlacement } from '../lib/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function DiaryForm({ initialRegionCode, onClose }: { initialRegionCode: string; onClose: () => void }) {
  const { createDiary } = useDiaries()
  const [regionCodes, setRegionCodes] = useState<string[]>([initialRegionCode])
  const [date, setDate] = useState(today())
  const [body, setBody] = useState('')
  const [satisfaction, setSatisfaction] = useState(5)
  const [revisit, setRevisit] = useState(false)
  const [revisitItems, setRevisitItems] = useState<string[]>([''])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPlacement, setPhotoPlacement] = useState<PhotoPlacement | null>(null)
  const [editingPlacement, setEditingPlacement] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPlacement(null)
    setEditingPlacement(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createDiary({
        date,
        body,
        satisfaction,
        revisit,
        regionCodes,
        revisitItems: revisit ? revisitItems.map((t) => t.trim()).filter(Boolean) : [],
        representativePhoto: photoFile && photoPlacement ? { file: photoFile, placement: photoPlacement } : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-md border border-line bg-bg p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">다이어리 작성</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <p className="mb-1 text-xs text-muted">지역</p>
            <RegionPicker selectedCodes={regionCodes} onChange={setRegionCodes} />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted">날짜</p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted">대표 사진</p>
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm text-ink" />
            {photoFile && photoPlacement && (
              <button
                type="button"
                onClick={() => setEditingPlacement(true)}
                className="mt-1 text-xs text-muted underline underline-offset-2"
              >
                배치 다시 조정하기
              </button>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs text-muted">본문</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted">만족도 {satisfaction.toFixed(1)}</p>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={satisfaction}
              onChange={(e) => setSatisfaction(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={revisit} onChange={(e) => setRevisit(e.target.checked)} />
              재방문 의사 있음
            </label>

            {revisit && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-xs text-muted">재방문 시 할 일</p>
                {revisitItems.map((item, i) => (
                  <input
                    key={i}
                    type="text"
                    value={item}
                    onChange={(e) =>
                      setRevisitItems((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                    }
                    placeholder="예: 그 카페 다시 가기"
                    className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setRevisitItems((prev) => [...prev, ''])}
                  className="self-start text-xs text-muted underline underline-offset-2"
                >
                  + 항목 추가
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-accent">{error}</p>}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-ink"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </form>
      </div>

      {editingPlacement && photoFile && (
        <PhotoPlacementEditor
          regionCodes={regionCodes}
          file={photoFile}
          initialPlacement={photoPlacement ?? undefined}
          onCancel={() => {
            setEditingPlacement(false)
            if (!photoPlacement) setPhotoFile(null)
          }}
          onConfirm={(placement) => {
            setPhotoPlacement(placement)
            setEditingPlacement(false)
          }}
        />
      )}
    </div>
  )
}
