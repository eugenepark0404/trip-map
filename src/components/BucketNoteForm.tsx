import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'

export function BucketNoteForm({ regionCode, onClose }: { regionCode: string; onClose: () => void }) {
  const { user } = useAuth()
  const { currentMapId } = useMaps()
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentMapId || !user) return
    const trimmed = memo.trim()
    if (!trimmed) {
      setError('내용을 입력해주세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.from('bucket_items').insert({
        map_id: currentMapId,
        region_code: regionCode,
        title: trimmed.slice(0, 40),
        memo: trimmed,
        created_by: user.id,
      })
      if (error) throw new Error(error.message)
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
        className="w-full max-w-sm rounded-t-md border border-line bg-bg p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">버킷일지 작성</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            autoFocus
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            placeholder="가고 싶은 이유, 하고 싶은 것 등을 적어두세요."
            className="w-full rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="flex gap-2">
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
    </div>
  )
}
