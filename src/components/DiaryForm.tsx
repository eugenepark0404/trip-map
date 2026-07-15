import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDiaries } from '../context/DiaryContext'
import { supabase } from '../lib/supabase'
import { RegionPicker } from './RegionPicker'
import { PhotoPlacementEditor } from './PhotoPlacementEditor'
import type { Diary, PhotoPlacement } from '../lib/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type PhotoItem = {
  key: string
  url: string
  placement: PhotoPlacement | null
  existingId: string | null // null for a newly-added, not-yet-uploaded photo
  file: File | null // null for an existing, already-uploaded photo
}

export function DiaryForm({
  regionCode,
  diary,
  onClose,
}: {
  regionCode: string
  diary?: Diary
  onClose: () => void
}) {
  const { createDiary, updateDiary, deleteDiary, deletePhoto: deletePhotoRemote, setRepresentativePhoto } = useDiaries()
  const [regionCodes, setRegionCodes] = useState<string[]>(diary?.regionCodes ?? [regionCode])
  const [date, setDate] = useState(diary?.date ?? today())
  const [body, setBody] = useState(diary?.body ?? '')
  const [satisfaction, setSatisfaction] = useState(diary?.satisfaction ?? 5)
  const [revisit, setRevisit] = useState(diary?.revisit ?? false)
  const [revisitItems, setRevisitItems] = useState<string[]>(() => {
    const texts = diary?.revisitItems.map((r) => r.text) ?? []
    return texts.length > 0 ? texts : ['']
  })
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [representativeKey, setRepresentativeKey] = useState<string | null>(null)
  const [editingPhotoKey, setEditingPhotoKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!diary) return
    let cancelled = false
    Promise.all(
      diary.photos.map(async (p) => {
        const { data } = await supabase.storage.from('diary-photos').createSignedUrl(p.storagePath, 3600)
        return {
          key: `existing:${p.id}`,
          url: data?.signedUrl ?? '',
          placement: p.placement,
          existingId: p.id,
          file: null as File | null,
        }
      }),
    ).then((items) => {
      if (cancelled) return
      setPhotos(items)
      const rep = diary.photos.find((p) => p.isRepresentative)
      if (rep) setRepresentativeKey(`existing:${rep.id}`)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diary?.id])

  useEffect(() => {
    return () => {
      for (const p of photos) if (p.file) URL.revokeObjectURL(p.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editingPhoto = useMemo(() => photos.find((p) => p.key === editingPhotoKey) ?? null, [photos, editingPhotoKey])

  function handleFilesAdded(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const added: PhotoItem[] = files.map((file) => ({
      key: `new:${crypto.randomUUID()}`,
      url: URL.createObjectURL(file),
      placement: null,
      existingId: null,
      file,
    }))
    setPhotos((prev) => [...prev, ...added])
    if (!representativeKey) {
      setRepresentativeKey(added[0].key)
      setEditingPhotoKey(added[0].key)
    }
    e.target.value = ''
  }

  function selectRepresentative(photo: PhotoItem) {
    setRepresentativeKey(photo.key)
    if (!photo.placement) setEditingPhotoKey(photo.key)
  }

  async function removePhoto(photo: PhotoItem) {
    if (photo.existingId) {
      await deletePhotoRemote(photo.existingId, photo.url)
    }
    setPhotos((prev) => prev.filter((p) => p.key !== photo.key))
    if (representativeKey === photo.key) setRepresentativeKey(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const newPhotos = photos
        .filter((p) => p.file)
        .map((p) => ({
          file: p.file!,
          isRepresentative: p.key === representativeKey,
          placement: p.key === representativeKey ? p.placement : null,
        }))

      const input = {
        date,
        body,
        satisfaction,
        revisit,
        regionCodes,
        revisitItems: revisit ? revisitItems.map((t) => t.trim()).filter(Boolean) : [],
        newPhotos,
      }

      if (diary) {
        // representative might now point at an existing photo that wasn't representative before
        const existingRep = photos.find((p) => p.key === representativeKey && p.existingId)
        if (existingRep && existingRep.placement) {
          await setRepresentativePhoto(diary.id, existingRep.existingId!, existingRep.placement)
        }
        await updateDiary(diary.id, input)
      } else {
        await createDiary(input)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!diary) return
    if (!confirm('이 다이어리를 삭제할까요? 사진도 함께 삭제되며 되돌릴 수 없습니다.')) return
    setSubmitting(true)
    try {
      await deleteDiary(diary.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-md border border-line bg-bg p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">{diary ? '다이어리 수정' : '다이어리 작성'}</h2>

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
            <p className="mb-1 text-xs text-muted">사진 (대표 사진은 별표로 지정)</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <div key={photo.key} className="relative h-16 w-16 overflow-hidden rounded-sm border border-line">
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => selectRepresentative(photo)}
                    aria-label="대표 사진으로 지정"
                    className={`absolute left-0.5 top-0.5 text-sm ${
                      photo.key === representativeKey ? 'text-accent' : 'text-bg/80'
                    }`}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo)}
                    aria-label="사진 삭제"
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/50 text-xs leading-none text-bg"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-sm border border-dashed border-line text-xs text-muted">
                + 추가
                <input type="file" accept="image/*" multiple onChange={handleFilesAdded} className="hidden" />
              </label>
            </div>
            {representativeKey && photos.find((p) => p.key === representativeKey)?.placement && (
              <button
                type="button"
                onClick={() => setEditingPhotoKey(representativeKey)}
                className="mt-1 text-xs text-muted underline underline-offset-2"
              >
                대표 사진 배치 다시 조정하기
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

          {diary && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="text-sm text-muted underline underline-offset-2 disabled:opacity-50"
            >
              다이어리 삭제
            </button>
          )}
        </form>
      </div>

      {editingPhoto && (
        <PhotoPlacementEditor
          regionCodes={regionCodes}
          imageUrl={editingPhoto.url}
          initialPlacement={editingPhoto.placement ?? undefined}
          onCancel={() => {
            setEditingPhotoKey(null)
            if (!editingPhoto.placement && representativeKey === editingPhoto.key) {
              setRepresentativeKey(null)
            }
          }}
          onConfirm={(placement) => {
            setPhotos((prev) => prev.map((p) => (p.key === editingPhoto.key ? { ...p, placement } : p)))
            setEditingPhotoKey(null)
          }}
        />
      )}
    </div>
  )
}
