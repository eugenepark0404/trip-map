import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { Sidebar } from '../components/Sidebar'
import { CreateMapModal } from '../components/CreateMapModal'
import { KoreaMap, type KoreaMapHandle } from '../components/KoreaMap'
import { SearchBar } from '../components/SearchBar'
import { RegionDiaryPanel } from '../components/RegionDiaryPanel'

export function HomePage() {
  const { user } = useAuth()
  const { maps, loading } = useMaps()
  const [creating, setCreating] = useState(false)
  const [diaryRegion, setDiaryRegion] = useState<string | null>(null)
  const mapRef = useRef<KoreaMapHandle>(null)

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
    <div className="relative h-svh overflow-hidden">
      <Sidebar onSelectRegion={(code) => mapRef.current?.focusRegion(code)} />
      <SearchBar onSelectRegion={(code) => mapRef.current?.focusRegion(code)} />
      <KoreaMap ref={mapRef} onRegionTap={setDiaryRegion} />
      {diaryRegion && <RegionDiaryPanel regionCode={diaryRegion} onClose={() => setDiaryRegion(null)} />}
    </div>
  )
}
