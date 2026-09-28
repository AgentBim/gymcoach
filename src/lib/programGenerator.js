// Pure program-generation logic: no React, no Supabase. Everything here works
// on the ProgramBuilder draft (see docs/handoffs/program-tools.md):
//
//   days:          { 'w1d0': { day_type, workout_id, workout_ref, notes } }
//   draftWorkouts: { [ref]: { ref, id, name, focus, exercises, prehab } }
//
// A cell points at a saved workout (workout_id) or an unsaved draft one
// (workout_ref), never both. Draft exercise items use save_workout's payload
// shape, so they can go straight to the save_program RPC.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MUSCLE_GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']

// Per-muscle selection weights. Values match the Program Tools mockup.
export const FOCUS_PRESETS = {
  'Full body': { Arms: 50, Back: 50, Legs: 50, Core: 50, Shoulders: 50 },
  Upper:       { Arms: 65, Back: 80, Legs: 5,  Core: 25, Shoulders: 70 },
  Lower:       { Arms: 5,  Back: 15, Legs: 90, Core: 55, Shoulders: 5 },
  Push:        { Arms: 55, Back: 5,  Legs: 5,  Core: 20, Shoulders: 85 },
  Pull:        { Arms: 60, Back: 90, Legs: 5,  Core: 20, Shoulders: 25 },
  Legs:        { Arms: 0,  Back: 10, Legs: 95, Core: 45, Shoulders: 0 },
  Back:        { Arms: 40, Back: 95, Legs: 5,  Core: 20, Shoulders: 20 },
  Shoulders:   { Arms: 40, Back: 20, Legs: 5,  Core: 20, Shoulders: 95 },
  Arms:        { Arms: 95, Back: 20, Legs: 5,  Core: 20, Shoulders: 40 },
  Core:        { Arms: 5,  Back: 20, Legs: 20, Core: 95, Shoulders: 5 },
}
export const CUSTOM_PRESET = 'Custom'

const MAX_NAME = 160

// No-replacement weighted pick: weightFor(muscle_group) supplies each
// exercise's relative selection weight from the body-part sliders. A
// zero-weight muscle group is never fully excluded (floored at .02, so it's
// just rare), and anything already picked earlier in this same generation
// pass (across every selected day, not just the current one) gets its
// weight cut to 12% so a whole week doesn't end up full of duplicates even
// though every day draws from the same pool.
export function weightedPick(pool, weightFor, n, usedIds) {
  const picks = []
  const remaining = pool.slice()
  for (let i = 0; i < n && remaining.length; i++) {
    const weights = remaining.map(ex => {
      let w = weightFor(ex.muscle_group)
      if (w <= 0) w = 0.02
      if (usedIds.has(ex.id)) w *= 0.12
      return w
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let idx = 0
    for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break }
    const chosen = remaining[idx]
    picks.push(chosen)
    usedIds.add(chosen.id)
    remaining.splice(idx, 1)
  }
  return picks
}

function toPayloadItem(ex, position) {
  return {
    exercise_id: ex.id,
    position,
    sets: ex.default_sets,
    reps: ex.default_reps || '',
    duration_seconds: ex.default_duration_seconds || '',
    rest_seconds: ex.default_rest_seconds,
  }
}

let refCounter = 0
export function newRef() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  refCounter += 1
  return `draft-${Date.now().toString(36)}-${refCounter}`
}

export function truncateName(name) {
  return name.length > MAX_NAME ? name.slice(0, MAX_NAME - 1).trimEnd() + '…' : name
}

export function splitPool(pool) {
  return {
    strength: pool.filter(e => (e.category || 'strength') === 'strength'),
    prehab: pool.filter(e => e.category === 'prehab'),
  }
}

// One draft workout: `count` strength picks weighted by focusWeights, then up
// to two prehab picks under the same weights. usedIds is shared across a whole
// generation run so repeats stay rare.
export function generateWorkout({ focusWeights, focus = null, count, includePrehab, pool, usedIds, name }) {
  const { strength, prehab } = splitPool(pool)
  const weightFor = muscle => focusWeights[muscle] || 0
  const main = weightedPick(strength, weightFor, count, usedIds)
  const extra = includePrehab && prehab.length
    ? weightedPick(prehab, weightFor, Math.min(2, prehab.length), usedIds)
    : []
  return {
    ref: newRef(),
    id: null,
    name: truncateName(name),
    focus,
    exercises: main.map((ex, i) => toPayloadItem(ex, i)),
    prehab: extra.map((ex, i) => toPayloadItem(ex, i)),
  }
}

// "Fill a week": one fresh workout per selected day, each with its own focus.
// Names follow "{Program} · {Focus} {n} · W{week}", where n counts days with
// the same focus in that week.
export function fillWeek({ programName, week, dayIdxs, dayFocus, count, includePrehab, pool }) {
  const usedIds = new Set()
  const seen = {}
  return dayIdxs.map(dayIdx => {
    const { preset, weights } = dayFocus[dayIdx]
    seen[preset] = (seen[preset] || 0) + 1
    const workout = generateWorkout({
      focusWeights: weights,
      focus: preset,
      count,
      includePrehab,
      pool,
      usedIds,
      name: `${programName.trim() || 'Program'} · ${preset} ${seen[preset]} · W${week}`,
    })
    return { dayIdx, workout }
  })
}

// Splits `count` exercises across muscle groups in proportion to weights
// (largest remainder), for the "Typical workout" summary.
export function typicalMix(weights, count) {
  const total = MUSCLE_GROUPS.reduce((sum, g) => sum + (weights[g] || 0), 0)
  const rows = MUSCLE_GROUPS.map(g => {
    const exact = total ? ((weights[g] || 0) / total) * count : count / MUSCLE_GROUPS.length
    return { group: g, n: Math.floor(exact), rem: exact - Math.floor(exact) }
  })
  let left = count - rows.reduce((sum, r) => sum + r.n, 0)
  rows.slice().sort((a, b) => b.rem - a.rem).forEach(r => { if (left > 0) { r.n += 1; left -= 1 } })
  return rows.filter(r => r.n > 0).map(({ group, n }) => ({ group, n }))
}

export function cellKey(week, dayIdx) {
  return `w${week}d${dayIdx}`
}

export function parseCellKey(key) {
  const match = /^w(\d+)d(\d)$/.exec(key)
  return match ? { week: parseInt(match[1], 10), dayIdx: parseInt(match[2], 10) } : null
}

// Draft workouts that at least one cell within the program's weeks uses.
export function referencedDraftRefs(days, weeks) {
  const refs = new Set()
  Object.entries(days).forEach(([key, cell]) => {
    const pos = parseCellKey(key)
    if (pos && pos.week <= weeks && cell.workout_ref) refs.add(cell.workout_ref)
  })
  return refs
}

export function weekHasDays(days, week) {
  return DAYS.some((_, d) => Boolean(days[cellKey(week, d)]))
}

// Generated names end in " · W{week}"; a copy for another week gets that
// week's number instead (or gains the suffix if it had none).
export function renameForWeek(name, sourceWeek, targetWeek) {
  const suffix = ` · W${sourceWeek}`
  const base = name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
  return truncateName(`${base} · W${targetWeek}`)
}

// "Progress the copies": +1 set per week after the source, capped at 6 (a
// base already above 6 is left alone). Prehab keeps its dosage.
function progressSets(sets, weeksAfter) {
  return weeksAfter > 0 ? Math.max(sets, Math.min(sets + weeksAfter, 6)) : sets
}

// Copies one week's cells to other weeks. Pure: returns the next draft plus
// the counts the Copy weeks footer shows, so the footer is computed by the
// same code that applies the copy.
//
// mode 'link':  target cells point at the same workout_id / workout_ref.
// mode 'clone': each target week gets its own draft copy of every workout
//               in the source week (one per source workout, so days that
//               shared a workout still share its copy). Saved workouts need
//               their contents in savedContent[id] = { name, exercises,
//               prehab }; when one is missing the copy is counted but not
//               made, and stats.missingContent is set.
// conflict 'replace': the target week mirrors the source for the copied day
//               types (a day that's empty in the source is cleared).
// conflict 'fill':    only days that are empty in the target are written.
// copyDayTypes false: only training days are copied; other target days stay.
// copyNotes false:    a written cell keeps the target's own note, if any.
export function copyWeeks(state, opts, savedContent = {}) {
  const { days, draftWorkouts } = state
  const { source, targets, mode, conflict, copyDayTypes, copyNotes, progress } = opts
  const nextDays = { ...days }
  const nextDrafts = { ...draftWorkouts }
  const stats = { daysWritten: 0, weeksWritten: 0, workoutsCreated: 0, missingContent: false }

  targets.filter(t => t !== source).forEach(target => {
    const clones = {}
    let wrote = false
    DAYS.forEach((_, d) => {
      const key = cellKey(target, d)
      const src = days[cellKey(source, d)]
      const existing = days[key]
      if (!src) {
        if (conflict === 'replace' && existing) delete nextDays[key]
        return
      }
      if (!copyDayTypes && src.day_type !== 'training') return
      if (conflict === 'fill' && existing) return

      let workout_id = src.workout_id || null
      let workout_ref = src.workout_ref || null
      if (mode === 'clone' && (workout_id || workout_ref)) {
        const srcKey = workout_ref ? `ref:${workout_ref}` : `id:${workout_id}`
        if (!(srcKey in clones)) {
          const content = workout_ref ? draftWorkouts[workout_ref] : savedContent[workout_id]
          stats.workoutsCreated += 1
          if (!content) {
            stats.missingContent = true
            clones[srcKey] = null
          } else {
            const clone = {
              ref: newRef(),
              id: null,
              name: renameForWeek(content.name, source, target),
              focus: content.focus || null,
              exercises: content.exercises.map(item => ({
                ...item,
                sets: progress ? progressSets(item.sets, target - source) : item.sets,
              })),
              prehab: (content.prehab || []).map(item => ({ ...item })),
            }
            nextDrafts[clone.ref] = clone
            clones[srcKey] = clone.ref
          }
        }
        workout_id = null
        workout_ref = clones[srcKey]
      }

      nextDays[key] = {
        day_type: src.day_type,
        workout_id,
        workout_ref,
        notes: copyNotes ? (src.notes || '') : (existing?.notes || ''),
      }
      stats.daysWritten += 1
      wrote = true
    })
    if (wrote) stats.weeksWritten += 1
  })

  return { days: nextDays, draftWorkouts: nextDrafts, stats }
}

// Drops draft workouts no cell points at any more (any week, so shrinking and
// re-growing the week count doesn't lose them).
export function pruneDraftWorkouts(days, draftWorkouts) {
  const used = referencedDraftRefs(days, Infinity)
  return Object.fromEntries(Object.entries(draftWorkouts).filter(([ref]) => used.has(ref)))
}

// save_program arguments for the current draft: cells beyond the week count
// are dropped, and only draft workouts the remaining cells use are sent.
export function buildSavePayload(days, draftWorkouts, weeks) {
  const refs = referencedDraftRefs(days, weeks)
  const p_days = []
  Object.entries(days).forEach(([key, cell]) => {
    const pos = parseCellKey(key)
    if (!pos || pos.week > weeks) return
    const ref = cell.workout_ref && draftWorkouts[cell.workout_ref] ? cell.workout_ref : null
    p_days.push({
      week: pos.week,
      day: pos.dayIdx,
      day_type: cell.day_type,
      workout_id: ref ? null : (cell.workout_id || null),
      workout_ref: ref,
      notes: cell.notes || null,
    })
  })
  const p_workouts = [...refs]
    .filter(ref => draftWorkouts[ref])
    .map(ref => {
      const { id, name, exercises, prehab } = draftWorkouts[ref]
      return { ref, id: id || null, name, exercises, prehab: prehab || [] }
    })
  return { p_days, p_workouts }
}

// A draft workout in the { name, exercises, prehabExercises } shape
// WorkoutPreviewCard renders, joined against the loaded exercise pool.
export function draftPreview(draft, poolById) {
  const join = (items, kind) => items.map(item => ({
    ...item,
    id: `${draft.ref}-${kind}-${item.position}`,
    reps: item.reps === '' ? null : item.reps,
    duration_seconds: item.duration_seconds === '' ? null : item.duration_seconds,
    exercises: poolById[item.exercise_id] || null,
  }))
  return {
    name: draft.name,
    exercises: join(draft.exercises, 'ex'),
    prehab: join(draft.prehab || [], 'pre'),
  }
}
