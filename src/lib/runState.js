// A workout in progress lives in sessionStorage so a refresh, or stepping out
// to the Today tab, doesn't lose which sets are done. Cleared once the
// feedback is sent.
const key = (athleteId, date, workoutId) => `chalkup:run:${athleteId}:${date}:${workoutId}`

export function readRun(athleteId, date, workoutId) {
  try {
    const raw = sessionStorage.getItem(key(athleteId, date, workoutId))
    if (raw) return JSON.parse(raw)
  } catch { /* storage unavailable: start fresh */ }
  return { done: {}, startedAt: Date.now() }
}

export function writeRun(athleteId, date, workoutId, state) {
  try { sessionStorage.setItem(key(athleteId, date, workoutId), JSON.stringify(state)) } catch { /* ignore */ }
}

export function clearRun(athleteId, date, workoutId) {
  try { sessionStorage.removeItem(key(athleteId, date, workoutId)) } catch { /* ignore */ }
}

/** The runner's rows: prehab first, then the main workout. */
export function runItems(exercises, prehabExercises) {
  const row = (group, x, prefix) => ({
    key: prefix + x.id, group, name: x.exercises?.name || 'Exercise', sets: x.sets,
    dose: `${x.sets} × ${x.reps || (x.duration_seconds ? x.duration_seconds + 's' : '–')}`,
    rest: x.rest_seconds || 0, cue: x.exercises?.description || '',
  })
  return [...prehabExercises.map(x => row('Prehab', x, 'p')), ...exercises.map(x => row('Main', x, 'e'))]
}

export function runTotals(items, done) {
  const count = it => Math.min(done[it.key] || 0, it.sets)
  const sum = list => list.reduce((a, it) => a + count(it), 0)
  const main = items.filter(i => i.group === 'Main')
  const pre = items.filter(i => i.group === 'Prehab')
  return {
    totalSets: items.reduce((a, it) => a + it.sets, 0),
    doneSets: sum(items),
    mainTotal: main.reduce((a, it) => a + it.sets, 0), mainDone: sum(main),
    prehabTotal: pre.reduce((a, it) => a + it.sets, 0), prehabDone: sum(pre),
    exercisesDone: main.filter(it => count(it) >= it.sets).length,
  }
}
