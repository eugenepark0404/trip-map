import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { Sidebar } from '../components/Sidebar'
import { CreateMapModal } from '../components/CreateMapModal'

export function HomePage() {
  const { user } = useAuth()
  const { maps, currentMap, loading } = useMaps()
  const [creating, setCreating] = useState(false)

  if (loading) return null

  if (maps.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted">{user?.user_metadata.display_name ?? user?.email}님, 환영합니다.</p>
        <p className="text-base text-ink">첫 지도를 만들어 기록을 시작하세요.</p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          지도 만들기
        </button>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-2 text-sm text-muted underline underline-offset-2"
        >
          로그아웃
        </button>
        {creating && <CreateMapModal onClose={() => setCreating(false)} />}
      </div>
    )
  }

  return (
    <div className="min-h-svh">
      <Sidebar />
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">{currentMap?.name}</p>
        <p className="text-sm text-muted">지도는 다음 단계에서 이어집니다.</p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-2 rounded-sm border border-line px-3 py-2 text-sm text-ink"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
