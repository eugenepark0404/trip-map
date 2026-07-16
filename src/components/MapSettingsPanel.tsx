import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import type { MapSummary } from '../lib/types'

type MemberRow = {
  userId: string
  role: 'owner' | 'member'
  displayName: string
}

type RawMemberRow = {
  user_id: string
  role: 'owner' | 'member'
  profiles: { display_name: string } | { display_name: string }[] | null
}

export function MapSettingsPanel({ map, onClose }: { map: MapSummary; onClose: () => void }) {
  const { user } = useAuth()
  const { inviteMember, deleteMap } = useMaps()
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = map.role === 'owner'

  async function loadMembers() {
    const { data, error } = await supabase
      .from('map_members')
      .select('user_id, role, profiles(display_name)')
      .eq('map_id', map.id)
    if (error) {
      console.error('멤버 조회 실패', error)
      return
    }
    const rows = (data ?? []) as unknown as RawMemberRow[]
    setMembers(
      rows.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return { userId: row.user_id, role: row.role, displayName: profile?.display_name ?? '이름 없음' }
      }),
    )
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setInviting(true)
    try {
      await inviteMember(map.id, email.trim())
      setEmail('')
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대에 실패했습니다.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberUserId: string) {
    if (!confirm('이 친구를 지도에서 제거할까요?')) return
    setRemovingId(memberUserId)
    try {
      const { error } = await supabase.from('map_members').delete().eq('map_id', map.id).eq('user_id', memberUserId)
      if (error) throw new Error(error.message)
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : '제거에 실패했습니다.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleDeleteMap() {
    if (!confirm(`"${map.name}" 지도를 삭제할까요? 지도 안의 모든 다이어리와 사진이 함께 삭제되며 되돌릴 수 없습니다.`)) return
    setDeleting(true)
    try {
      await deleteMap(map.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-md border border-line bg-bg p-5 sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-medium text-ink">{map.name} 설정</h2>

        <section className="mb-5">
          <p className="mb-2 text-xs text-muted">참여자</p>
          {members === null ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-2 px-1 py-1.5 text-sm">
                  <span className="text-ink">
                    {member.displayName}
                    {member.role === 'owner' && <span className="ml-1 text-xs text-muted">(소유자)</span>}
                  </span>
                  {isOwner && member.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.userId)}
                      disabled={removingId === member.userId}
                      className="text-xs text-muted underline underline-offset-2 disabled:opacity-50"
                    >
                      제거
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-5">
          <p className="mb-2 text-xs text-muted">친구 추가</p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="flex-1 rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={inviting}
              className="rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              초대
            </button>
          </form>
        </section>

        {error && <p className="mb-3 text-sm text-accent">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-ink">
            닫기
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={handleDeleteMap}
              disabled={deleting}
              className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-muted disabled:opacity-50"
            >
              지도 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
