export const MEDIA_FIELDS = 'exercise_id,media_asset_id,version_id,publication_revision,storage_bucket,video_path,poster_path,width,height,duration_ms,demonstration_note,exercise_note'

export function mediaEnabled(exercise, config) {
  return Boolean(config.enabled && exercise?.id && exercise.is_custom !== true && !exercise.coach_id &&
    config.sections.includes(`${exercise.category}:${exercise.muscle_group}`))
}

export function validMedia(media) {
  return Boolean(media?.media_asset_id && media.version_id && media.storage_bucket === 'exercise-library' &&
    /^library\/animations\/[0-9a-f]{64}\.mp4$/.test(media.video_path) &&
    /^library\/posters\/[0-9a-f]{64}\.webp$/.test(media.poster_path) &&
    Number.isInteger(media.width) && media.width > 0 && media.width <= 8192 &&
    Number.isInteger(media.height) && media.height > 0 && media.height <= 8192 &&
    Number.isInteger(media.duration_ms) && media.duration_ms > 0 && media.duration_ms <= 86400000)
}

export async function attachMedia(client, exercises, config) {
  const ids = [...new Set(exercises.filter(e => mediaEnabled(e, config)).map(e => e.id))]
  if (!ids.length) return exercises
  try {
    const metadata = []
    for (let offset = 0; offset < ids.length; offset += 80) {
      const { data, error } = await client.from('exercise_media').select(MEDIA_FIELDS).in('exercise_id', ids.slice(offset, offset + 80))
      if (error) return exercises.map(e => ({ ...e, media: null }))
      metadata.push(...(data || []).filter(validMedia))
    }
    const byId = new Map(metadata.map(m => [m.exercise_id, m]))
    return exercises.map(e => ({ ...e, media: byId.get(e.id) || null }))
  } catch {
    // Media availability must not prevent exercise selection or a workout.
    return exercises.map(e => ({ ...e, media: null }))
  }
}

export async function attachWorkoutMedia(client, main, prehab, config) {
  const hydrated = await attachMedia(client, [...main, ...prehab].map(row => row.exercises).filter(Boolean), config)
  const byId = new Map(hydrated.map(e => [e.id, e]))
  const apply = list => list.map(row => ({ ...row, exercises: byId.get(row.exercises?.id) || row.exercises }))
  return { exercises: apply(main), prehab: apply(prehab) }
}
