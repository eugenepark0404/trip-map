import { useState } from 'react'
import { useMaps } from '../context/MapContext'
import { supabase } from '../lib/supabase'
import { MapSwitcher } from './MapSwitcher'
import { FavoritesList } from './FavoritesList'

export function Sidebar({ onSelectRegion }: { onSelectRegion: (regionCode: string) => void }) {
  const { currentMap } = useMaps()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'switcher'>('menu')

  function close() {
    setOpen(false)
    setView('menu')
  }

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-px w-4 bg-ink" />
          <span className="block h-px w-4 bg-ink" />
          <span className="block h-px w-4 bg-ink" />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink/10" onClick={close} />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-bg p-5">
            {view === 'menu' ? (
              <>
                <p className="text-base font-medium text-ink">{currentMap?.name ?? '지도 없음'}</p>
                <button
                  type="button"
                  onClick={() => setView('switcher')}
                  className="mt-1 self-start text-xs text-muted underline underline-offset-2"
                >
                  지도 설정
                </button>

                <div className="mt-8 flex flex-col gap-6 overflow-y-auto">
                  <section>
                    <p className="mb-2 text-xs text-muted">즐겨찾기</p>
                    <FavoritesList
                      onSelectRegion={(code) => {
                        close()
                        onSelectRegion(code)
                      }}
                    />
                  </section>
                  <section>
                    <p className="mb-2 text-xs text-muted">버킷여행지</p>
                    <p className="text-sm text-muted">등록한 버킷여행지가 없습니다.</p>
                  </section>
                </div>

                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="mt-auto self-start pt-6 text-xs text-muted underline underline-offset-2"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setView('menu')}
                  className="mb-4 self-start text-xs text-muted underline underline-offset-2"
                >
                  ← 뒤로
                </button>
                <MapSwitcher onSelect={close} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
