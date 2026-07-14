import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted">{user?.user_metadata.display_name ?? user?.email}님, 환영합니다.</p>
      <p className="text-sm text-muted">지도는 다음 단계에서 이어집니다.</p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
      >
        로그아웃
      </button>
    </div>
  )
}
