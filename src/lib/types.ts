export type MapRole = 'owner' | 'member'

export type MapSummary = {
  id: string
  name: string
  role: MapRole
}

export type PhotoPlacement = {
  scale: number
  x: number
  y: number
  rotation: number
}

export type RevisitItem = {
  id: string
  text: string
  done: boolean
}

export type DiaryPhoto = {
  id: string
  storagePath: string
  isRepresentative: boolean
  placement: PhotoPlacement | null
}

export type Diary = {
  id: string
  mapId: string
  date: string
  body: string
  satisfaction: number | null
  revisit: boolean
  regionCodes: string[]
  revisitItems: RevisitItem[]
  photos: DiaryPhoto[]
}

export type NewDiaryInput = {
  date: string
  body: string
  satisfaction: number | null
  revisit: boolean
  regionCodes: string[]
  revisitItems: string[]
  representativePhoto: { file: File; placement: PhotoPlacement } | null
}
