import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useMaps } from './MapContext'
import type { Diary, DiaryInput, PhotoPlacement } from '../lib/types'

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
  regionToDiary: Map<string, Diary[]>
  photoUrls: Map<string, string>
  refresh: () => Promise<void>
  createDiary: (input: DiaryInput) => Promise<void>
  updateDiary: (diaryId: string, input: DiaryInput) => Promise<void>
  deleteDiary: (diaryId: string) => Promise<void>
  deletePhoto: (photoId: string, storagePath: string) => Promise<void>
  setRepresentativePhoto: (diaryId: string, photoId: string, placement: PhotoPlacement) => Promise<void>
}

const DiaryContext = createContext<DiaryContextState | null>(null)

const SELECT =
  'id, date, body, satisfaction, revisit, diary_regions(region_code), diary_photos(id, storage_path, is_representative, placement), revisit_items(id, text, done)'

async function uploadPhotos(mapId: string, diaryId: string, photos: DiaryInput['newPhotos']) {
  for (const photo of photos) {
    const ext = photo.file.name.split('.').pop() ?? 'jpg'
    const path = `${mapId}/${diaryId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('diary-photos')
      .upload(path, photo.file, { contentType: photo.file.type })
    if (uploadError) throw new Error(uploadError.message)

    if (photo.isRepresentative) {
      // only one representative photo per diary — clear any other flag first
      await supabase.from('diary_photos').update({ is_representative: false }).eq('diary_id', diaryId)
    }

    const { error: photoError } = await supabase.from('diary_photos').insert({
      diary_id: diaryId,
      storage_path: path,
      is_representative: photo.isRepresentative,
      placement: photo.placement,
    })
    if (photoError) throw new Error(photoError.message)
  }
}

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
    async (input: DiaryInput) => {
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

      await uploadPhotos(currentMapId, diary.id, input.newPhotos)
      await refresh()
    },
    [currentMapId, user, refresh],
  )

  const updateDiary = useCallback(
    async (diaryId: string, input: DiaryInput) => {
      if (!currentMapId) throw new Error('로그인이 필요합니다.')
      if (input.regionCodes.length === 0) throw new Error('최소 한 개의 지역을 선택해주세요.')

      const { error } = await supabase
        .from('diaries')
        .update({ date: input.date, body: input.body, satisfaction: input.satisfaction, revisit: input.revisit })
        .eq('id', diaryId)
      if (error) throw new Error(error.message)

      await supabase.from('diary_regions').delete().eq('diary_id', diaryId)
      const { error: regionsError } = await supabase
        .from('diary_regions')
        .insert(input.regionCodes.map((region_code) => ({ diary_id: diaryId, region_code })))
      if (regionsError) throw new Error(regionsError.message)

      await supabase.from('revisit_items').delete().eq('diary_id', diaryId)
      if (input.revisitItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('revisit_items')
          .insert(input.revisitItems.map((text) => ({ diary_id: diaryId, text })))
        if (itemsError) throw new Error(itemsError.message)
      }

      await uploadPhotos(currentMapId, diaryId, input.newPhotos)
      await refresh()
    },
    [currentMapId, refresh],
  )

  const deleteDiary = useCallback(
    async (diaryId: string) => {
      const diary = diaries.find((d) => d.id === diaryId)
      const { error } = await supabase.from('diaries').delete().eq('id', diaryId)
      if (error) throw new Error(error.message)
      if (diary && diary.photos.length > 0) {
        await supabase.storage.from('diary-photos').remove(diary.photos.map((p) => p.storagePath))
      }
      await refresh()
    },
    [diaries, refresh],
  )

  const deletePhoto = useCallback(
    async (photoId: string, storagePath: string) => {
      const { error } = await supabase.from('diary_photos').delete().eq('id', photoId)
      if (error) throw new Error(error.message)
      await supabase.storage.from('diary-photos').remove([storagePath])
      await refresh()
    },
    [refresh],
  )

  const setRepresentativePhoto = useCallback(
    async (diaryId: string, photoId: string, placement: PhotoPlacement) => {
      await supabase.from('diary_photos').update({ is_representative: false }).eq('diary_id', diaryId)
      const { error } = await supabase
        .from('diary_photos')
        .update({ is_representative: true, placement })
        .eq('id', photoId)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [refresh],
  )

  const regionToDiary = new Map<string, Diary[]>()
  for (const diary of diaries) {
    for (const code of diary.regionCodes) {
      if (!regionToDiary.has(code)) regionToDiary.set(code, [])
      regionToDiary.get(code)!.push(diary)
    }
  }

  return (
    <DiaryContext.Provider
      value={{
        diaries,
        loading,
        regionToDiary,
        photoUrls,
        refresh,
        createDiary,
        updateDiary,
        deleteDiary,
        deletePhoto,
        setRepresentativePhoto,
      }}
    >
      {children}
    </DiaryContext.Provider>
  )
}

export function useDiaries() {
  const ctx = useContext(DiaryContext)
  if (!ctx) throw new Error('useDiaries는 DiaryProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
