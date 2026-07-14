import { useState, type FormEvent } from 'react'
import { useMaps } from '../context/MapContext'

export function CreateMapModal({ onClose }: { onClose: () => void }) {
  const { createMap } = useMaps()
  const [name, setName] = useState('')
  const [emails, setEmails] = useState([''])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('지도 이름을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await createMap(name.trim(), emails)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '지도 생성에 실패했습니다.')
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
        <h2 className="mb-4 text-base font-medium text-ink">새 지도 만들기</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            placeholder="지도 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <p className="mt-2 text-xs text-muted">친구 초대 (이메일, 선택)</p>
          {emails.map((email, i) => (
            <input
              key={i}
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
              className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
          ))}
          <button
            type="button"
            onClick={() => setEmails((prev) => [...prev, ''])}
            className="self-start text-xs text-muted underline underline-offset-2"
          >
            + 친구 추가
          </button>

          {error && <p className="text-sm text-accent">{error}</p>}

          <div className="mt-3 flex gap-2">
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
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
