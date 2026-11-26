import { attachMedia, attachWorkoutMedia, mediaEnabled, validMedia } from './mediaPolicy'
import { supabase } from './supabase'

export const mediaConfig = {
  enabled: import.meta.env.VITE_EXERCISE_MEDIA_ENABLED === 'true',
  sections: (import.meta.env.VITE_EXERCISE_MEDIA_SECTIONS || 'strength:Legs').split(',').map(s => s.trim()).filter(Boolean),
}

export const hydrateExerciseMedia = exercises => attachMedia(supabase, exercises, mediaConfig)
export const hydrateWorkoutMedia = (main, prehab) => attachWorkoutMedia(supabase, main, prehab, mediaConfig)

export function exerciseMedia(exercise) {
  if (!mediaEnabled(exercise, mediaConfig) || !validMedia(exercise.media)) return null
  const media = exercise.media
  return {
    ...media,
    videoUrl: supabase.storage.from(media.storage_bucket).getPublicUrl(media.video_path).data.publicUrl,
    posterUrl: supabase.storage.from(media.storage_bucket).getPublicUrl(media.poster_path).data.publicUrl,
  }
}
