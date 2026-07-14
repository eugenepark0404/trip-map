import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { MapSummary } from '../lib/types'
import { useAuth } from './AuthContext'

type MapContextState = {
  maps: MapSummary[]
  currentMapId: string | null
  currentMap: MapSummary | null
  loading: boolean
  switchMap: (mapId: string) => Promise<void>
  createMap: (name: string, inviteEmails: string[]) => Promise<string>
  inviteMember: (mapId: string, email: string) => Promise<void>
  refresh: () => Promise<void>
}

const MapContext = createContext<MapContextState | null>(null)

type MapMemberRow = {
  role: 'owner' | 'member'
  maps: { id: string; name: string } | { id: string; name: string }[] | null
}

export function MapProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [maps, setMaps] = useState<MapSummary[]>([])
  const [currentMapId, setCurrentMapId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setMaps([])
      setCurrentMapId(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const [{ data: memberRows, error: memberError }, { data: profile }] = await Promise.all([
      supabase.from('map_members').select('role, maps(id, name)').eq('user_id', user.id),
      supabase.from('profiles').select('default_map_id').eq('id', user.id).single(),
    ])

    if (memberError) {
      console.error('지도 목록 조회 실패', memberError)
      setLoading(false)
      return
    }

    const list: MapSummary[] = ((memberRows ?? []) as MapMemberRow[])
      .map((row) => {
        const map = Array.isArray(row.maps) ? row.maps[0] : row.maps
        if (!map) return null
        return { id: map.id, name: map.name, role: row.role }
      })
      .filter((m): m is MapSummary => m !== null)

    setMaps(list)

    const defaultId = profile?.default_map_id
    const resolved = list.find((m) => m.id === defaultId)?.id ?? list[0]?.id ?? null
    setCurrentMapId(resolved)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const switchMap = useCallback(
    async (mapId: string) => {
      setCurrentMapId(mapId)
      if (!user) return
      const { error } = await supabase.from('profiles').update({ default_map_id: mapId }).eq('id', user.id)
      if (error) console.error('대표 지도 갱신 실패', error)
    },
    [user],
  )

  const createMap = useCallback(
    async (name: string, inviteEmails: string[]) => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const { data, error } = await supabase.from('maps').insert({ name, owner_id: user.id }).select('id').single()
      if (error || !data) throw new Error(error?.message ?? '지도 생성에 실패했습니다.')

      for (const email of inviteEmails) {
        const trimmed = email.trim()
        if (!trimmed) continue
        const { error: inviteError } = await supabase.rpc('invite_member_by_email', {
          p_map_id: data.id,
          p_email: trimmed,
        })
        if (inviteError) console.error(`초대 실패: ${trimmed}`, inviteError)
      }

      await refresh()
      await switchMap(data.id)
      return data.id as string
    },
    [user, refresh, switchMap],
  )

  const inviteMember = useCallback(async (mapId: string, email: string) => {
    const { error } = await supabase.rpc('invite_member_by_email', { p_map_id: mapId, p_email: email.trim() })
    if (error) throw new Error(error.message)
  }, [])

  const currentMap = maps.find((m) => m.id === currentMapId) ?? null

  return (
    <MapContext.Provider
      value={{ maps, currentMapId, currentMap, loading, switchMap, createMap, inviteMember, refresh }}
    >
      {children}
    </MapContext.Provider>
  )
}

export function useMaps() {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMaps는 MapProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
