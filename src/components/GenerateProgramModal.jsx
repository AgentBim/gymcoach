import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MUSCLE_COLORS } from '../lib/theme'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']

// No-replacement weighted pick: weightFor(muscle_group) supplies each
// exercise's relative selection weight from the body-part sliders. A
// zero-weight muscle group is never fully excluded (floored at .02, so it's
// just rare), and anything already picked earlier in this same generation
// pass (across every selected day, not just the current one) gets its
// weight cut to 12% so a whole week doesn't end up full of duplicates even
// though every day draws from the same pool.
function weightedPick(pool, weightFor, n, usedIds) {
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

// programName/week/dayTypes describe the week being filled: dayTypes[i] is
// that day-of-week's current type in the program draft, used only to pick
// sensible defaults (pre-check days already set to "training", else
// default to weekdays) — this modal never reads or writes the draft
// directly. onGenerated(results, uncheckedDayIdxs) hands the parent what to
// do with its own `days` state: results is [{ dayIdx, workoutId }], and
// uncheckedDayIdxs are indices that were "training" before but got
// unchecked here, which the parent resets to rest (any other day type is
// left untouched either way).
export default function GenerateProgramModal({ programName, week, weeks, dayTypes, onClose, onGenerated }) {
  const hasExistingTraining = dayTypes.some(t => t === 'training')
  const [checkedDays, setCheckedDays] = useState(() =>
    DAYS.map((_, i) => (hasExistingTraining ? dayTypes[i] === 'training' : i < 5))
  )
  const [targetWeek, setTargetWeek] = useState(week)
  const [count, setCount] = useState(6)
  const [includePrehab, setIncludePrehab] = useState(true)
  const [weights, setWeights] = useState(() => Object.fromEntries(GROUPS.map(g => [g, 50])))
  const [exercises, setExercises] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchExercises() }, [])

  async function fetchExercises() {
    const { data } = await supabase.from('exercises').select('*')
    setExercises(data || [])
  }

  const totalWeight = GROUPS.reduce((sum, g) => sum + weights[g], 0)
  const trainingCount = checkedDays.filter(Boolean).length

  function toggleDay(i) {
    setCheckedDays(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  async function generate() {
    setError('')
    setGenerating(true)

    const strengthPool = exercises.filter(e => (e.category || 'strength') === 'strength')
    const prehabPool = exercises.filter(e => e.category === 'prehab')
    const weightFor = muscle => weights[muscle] || 0
    const usedIds = new Set()
    const results = []

    try {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        if (!checkedDays[dayIdx]) continue

        const mainPicks = weightedPick(strengthPool, weightFor, count, usedIds)
        const pExercises = mainPicks.map((ex, i) => toPayloadItem(ex, i))

        let pPrehab = []
        if (includePrehab && prehabPool.length) {
          const prehabPicks = weightedPick(prehabPool, weightFor, Math.min(2, prehabPool.length), usedIds)
          pPrehab = prehabPicks.map((ex, i) => toPayloadItem(ex, i))
        }

        const workoutName = `${programName || 'Program'} · ${DAYS[dayIdx]}`
        const { data: workoutId, error: saveError } = await supabase.rpc('save_workout', {
          p_workout_id: null,
          p_name: workoutName,
          p_is_ai_generated: false,
          p_exercises: pExercises,
          p_prehab: pPrehab,
        })
        if (saveError) throw saveError

        results.push({ dayIdx, workoutId, workoutName })
      }

      const uncheckedDayIdxs = DAYS
        .map((_, i) => i)
        .filter(i => !checkedDays[i] && dayTypes[i] === 'training')

      onGenerated(targetWeek, results, uncheckedDayIdxs)
    } catch (err) {
      setError(err.message || 'Something went wrong generating the program')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 380, maxHeight: '86vh', overflowY: 'auto', background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>Generate program</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--mu)', marginBottom: 16 }}>Randomly fills the days you pick from your library, weighted toward the body parts you emphasize below</p>

        {weeks > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>Week</div>
            <select value={targetWeek} onChange={e => setTargetWeek(parseInt(e.target.value, 10))}
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none' }}>
              {Array.from({ length: weeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Training days</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {DAYS.map((d, i) => (
            <span key={d} onClick={() => toggleDay(i)}
              style={{ fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
                background: checkedDays[i] ? 'rgba(199,228,92,.16)' : 'transparent',
                color: checkedDays[i] ? 'var(--ac)' : 'var(--mu)',
                border: `1px ${checkedDays[i] ? 'solid rgba(199,228,92,.4)' : 'dashed var(--br)'}` }}>
              {d}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 6 }}>Exercises per workout</div>
            <input type="number" min={2} max={10} value={count} onChange={e => setCount(Math.min(10, Math.max(2, parseInt(e.target.value, 10) || 2)))}
              style={{ width: '100%', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 9 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx)', cursor: 'pointer' }}>
              <input type="checkbox" checked={includePrehab} onChange={e => setIncludePrehab(e.target.checked)} />
              Include prehab warm-up
            </label>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Body-part emphasis</div>
        {GROUPS.map(g => {
          const c = MUSCLE_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
          const pct = totalWeight ? Math.round((weights[g] / totalWeight) * 100) : Math.round(100 / GROUPS.length)
          return (
            <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ width: 78, flexShrink: 0, fontSize: 10.5, fontWeight: 600, padding: '3px 0', borderRadius: 20, textAlign: 'center', background: c.bg, color: c.color }}>{g}</span>
              <input type="range" min={0} max={100} value={weights[g]} onChange={e => setWeights(prev => ({ ...prev, [g]: parseInt(e.target.value, 10) }))}
                style={{ flex: 1, cursor: 'pointer' }} />
              <span style={{ width: 32, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{pct}%</span>
            </div>
          )
        })}
        <p style={{ fontSize: 10.5, color: 'var(--mu)', margin: '4px 0 16px', lineHeight: 1.5 }}>Higher = more of that muscle group across the generated workouts. Sliders don't need to add up to 100 — they're weighted relative to each other.</p>

        {error && <p style={{ fontSize: 12, color: '#E2695A', marginBottom: 10 }}>{error}</p>}

        <button onClick={generate} disabled={!trainingCount || generating || !exercises.length}
          style={{ width: '100%', padding: 11, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: (!trainingCount || generating || !exercises.length) ? 0.5 : 1 }}>
          {generating ? 'Generating…' : `🔀 Generate ${trainingCount || ''} workout${trainingCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
