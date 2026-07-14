import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useMaps } from './MapContext'
import type { Diary, NewDiaryInput } from '../lib/types'

type DiaryRow = {
  id: string
  date: string
  body: string
  satisfaction: number | null
  revisit: boolean
  diary_regions: { region_code: string }[]
  diary_photos: { id: string; storage_path: string; is_representative: boolean; placement: unknown }[]
  revisit_items: { id: string; text: string; done: boolean }[]
}

type DiaryContextState = {
  diaries: Diary[]
  loading: boolean
  regionToDiary: Map<string, Diary>
  photoUrls: Map<string, string>
  refresh: () => Promise<void>
  createDiary: (input: NewDiaryInput) => Promise<void>
}

const DiaryContext = createContext<DiaryContextState | null>(null)

const SELECT = 'id, date, body, satisfaction, revisit, diary_regions(region_code), diary_photos(id, storage_path, is_representative, placement), revisit_items(id, text, done)'

export function DiaryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { currentMapId } = useMaps()
  const [diaries, setDiaries] = useState<Diary[]>([])
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!currentMapId) {
      setDiaries([])
      setPhotoUrls(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('diaries').select(SELECT).eq('map_id', currentMapId)
    if (error) {
      console.error('다이어리 조회 실패', error)
      setLoading(false)
      return
    }
    const rows = (data ?? []) as unknown as DiaryRow[]
    const nextDiaries = rows.map((row) => ({
      id: row.id,
      mapId: currentMapId,
      date: row.date,
      body: row.body,
      satisfaction: row.satisfaction,
      revisit: row.revisit,
      regionCodes: row.diary_regions.map((r) => r.region_code),
      revisitItems: row.revisit_items.map((r) => ({ id: r.id, text: r.text, done: r.done })),
      photos: row.diary_photos.map((p) => ({
        id: p.id,
        storagePath: p.storage_path,
        isRepresentative: p.is_representative,
        placement: (p.placement as Diary['photos'][number]['placement']) ?? null,
      })),
    }))
    setDiaries(nextDiaries)

    const entries = await Promise.all(
      nextDiaries.map(async (diary) => {
        const rep = diary.photos.find((p) => p.isRepresentative && p.placement)
        if (!rep) return null
        const { data: signed } = await supabase.storage.from('diary-photos').createSignedUrl(rep.storagePath, 3600)
        return signed ? ([diary.id, signed.signedUrl] as const) : null
      }),
    )
    setPhotoUrls(new Map(entries.filter((e): e is readonly [string, string] => e !== null)))
    setLoading(false)
  }, [currentMapId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createDiary = useCallback(
    async (input: NewDiaryInput) => {
      if (!currentMapId || !user) throw new Error('로그인이 필요합니다.')
      if (input.regionCodes.length === 0) throw new Error('최소 한 개의 지역을 선택해주세요.')

      const { data: diary, error } = await supabase
        .from('diaries')
        .insert({
          map_id: currentMapId,
          date: input.date,
          body: input.body,
          satisfaction: input.satisfaction,
          revisit: input.revisit,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error || !diary) throw new Error(error?.message ?? '다이어리 저장에 실패했습니다.')

      const { error: regionsError } = await supabase
        .from('diary_regions')
        .insert(input.regionCodes.map((region_code) => ({ diary_id: diary.id, region_code })))
      if (regionsError) throw new Error(regionsError.message)

      if (input.revisitItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('revisit_items')
          .insert(input.revisitItems.map((text) => ({ diary_id: diary.id, text })))
        if (itemsError) throw new Error(itemsError.message)
      }

      if (input.representativePhoto) {
        const { file, placement } = input.representativePhoto
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${currentMapId}/${diary.id}/representative.${ext}`
        const { error: uploadError } = await supabase.storage.from('diary-photos').upload(path, file, {
          upsert: true,
          contentType: file.type,
        })
        if (uploadError) throw new Error(uploadError.message)

        const { error: photoError } = await supabase.from('diary_photos').insert({
          diary_id: diary.id,
          storage_path: path,
          is_representative: true,
          placement,
        })
        if (photoError) throw new Error(photoError.message)
      }

      await refresh()
    },
    [currentMapId, user, refresh],
  )

  const regionToDiary = new Map<string, Diary>()
  for (const diary of diaries) {
    for (const code of diary.regionCodes) regionToDiary.set(code, diary)
  }

  return (
    <DiaryContext.Provider value={{ diaries, loading, regionToDiary, photoUrls, refresh, createDiary }}>
      {children}
    </DiaryContext.Provider>
  )
}

export function useDiaries() {
  const ctx = useContext(DiaryContext)
  if (!ctx) throw new Error('useDiaries는 DiaryProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
