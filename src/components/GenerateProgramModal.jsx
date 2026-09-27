import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import DayFocusEditor from './DayFocusEditor'
import { DAYS, FOCUS_PRESETS, cellKey, fillWeek, splitPool } from '../lib/programGenerator'

const DEFAULT_PRESET = 'Full body'

// "Fill a week": randomizes the picked days of one week, each weighted toward
// its own body-part focus. Draft-first: it never writes to the database. It
// hands the parent new draft workouts through onApply({ week, results,
// restDayIdxs }), and the parent snapshots its draft (so this is undoable)
// before applying them:
//   results      [{ dayIdx, workout }], workout being a draft workout
//   restDayIdxs  days that were "training" in that week but got unchecked
//                here, which the parent resets to rest (any other day type
//                is left untouched either way)
//
// days is the program draft, read only to pre-check days already set to
// "training" (else default to weekdays). pool is the exercise library, or
// null while it loads.
export default function GenerateProgramModal({ programName, week, weeks, days, pool, poolError, onClose, onApply }) {
  const isMobile = useIsMobile()
  const [checkedDays, setCheckedDays] = useState(() => {
    const types = DAYS.map((_, i) => days[cellKey(week, i)]?.day_type || null)
    const hasTraining = types.some(t => t === 'training')
    return DAYS.map((_, i) => (hasTraining ? types[i] === 'training' : i < 5))
  })
  const [targetWeek, setTargetWeek] = useState(week)
  const [count, setCount] = useState(6)
  const [includePrehab, setIncludePrehab] = useState(true)
  const [dayFocus, setDayFocus] = useState(() =>
    Object.fromEntries(DAYS.map((_, i) => [i, { preset: DEFAULT_PRESET, weights: { ...FOCUS_PRESETS[DEFAULT_PRESET] } }]))
  )
  const [error, setError] = useState('')

  const dayIdxs = DAYS.map((_, i) => i).filter(i => checkedDays[i])
  const loading = !pool && !poolError
  const canGenerate = dayIdxs.length > 0 && pool && pool.length > 0

  function toggleDay(i) {
    setCheckedDays(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  function generate() {
    setError('')
    if (!splitPool(pool).strength.length) {
      setError('Your exercise library has no strength exercises to pick from')
      return
    }
    const results = fillWeek({ programName, week: targetWeek, dayIdxs, dayFocus, count, includePrehab, pool })
    const restDayIdxs = DAYS.map((_, i) => i)
      .filter(i => !checkedDays[i] && days[cellKey(targetWeek, i)]?.day_type === 'training')
    onApply({ week: targetWeek, results, restDayIdxs })
  }

  const label = { fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }
  const field = { width: '100%', minHeight: 44, boxSizing: 'border-box', background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '8px 10px', fontSize: 13, outline: 'none' }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Fill a week" onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 460, maxWidth: '100%', maxHeight: isMobile ? '100%' : '88vh', display: 'flex', flexDirection: 'column', background: 'var(--s1)', border: isMobile ? 'none' : '1px solid var(--br)', borderRadius: isMobile ? 0 : 14, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 12px', paddingTop: isMobile ? 'max(14px, calc(var(--sat) + 8px))' : 18, borderBottom: '1px solid var(--br)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)' }}>Fill a week</div>
            <p style={{ fontSize: 11.5, color: 'var(--mu)', margin: '4px 0 0', lineHeight: 1.45 }}>Randomly fills the days you pick from your library, each weighted toward its own focus. Nothing is saved until you press Save, and you can undo it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, flexShrink: 0, margin: '-8px -8px 0 0', background: 'none', border: 'none', color: 'var(--mu)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {weeks > 1 && (
            <div>
              <div style={label}>Week</div>
              <select value={targetWeek} onChange={e => setTargetWeek(parseInt(e.target.value, 10))} aria-label="Week to fill" style={field}>
                {Array.from({ length: weeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
          )}

          <div>
            <div style={label}>Training days</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
              {DAYS.map((d, i) => (
                <button key={d} type="button" aria-pressed={checkedDays[i]} onClick={() => toggleDay(i)}
                  style={{ minHeight: 44, fontSize: 12, fontWeight: 600, borderRadius: 10, cursor: 'pointer', padding: 0,
                    background: checkedDays[i] ? 'rgba(199,228,92,.16)' : 'transparent',
                    color: checkedDays[i] ? 'var(--ac)' : 'var(--mu)',
                    border: `1px ${checkedDays[i] ? 'solid rgba(199,228,92,.4)' : 'dashed var(--br)'}` }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Exercises per workout</div>
              <input type="number" min={2} max={10} value={count} aria-label="Exercises per workout"
                onChange={e => setCount(Math.min(10, Math.max(2, parseInt(e.target.value, 10) || 2)))} style={field} />
            </div>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 12.5, color: 'var(--tx)', cursor: 'pointer' }}>
              <input type="checkbox" checked={includePrehab} onChange={e => setIncludePrehab(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ac)' }} />
              Include prehab warm-up
            </label>
          </div>

          <div>
            <div style={label}>Day focus</div>
            <DayFocusEditor dayIdxs={dayIdxs} focus={dayFocus} onChange={setDayFocus} count={count} initialMatchSame={false} />
          </div>
        </div>

        <div style={{ padding: '12px 16px', paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 12px)' : 16, borderTop: '1px solid var(--br)' }}>
          {(error || poolError) && <p style={{ fontSize: 12, color: '#E2695A', margin: '0 0 10px' }}>{error || poolError}</p>}
          {pool && pool.length === 0 && <p style={{ fontSize: 12, color: 'var(--mu)', margin: '0 0 10px' }}>Your exercise library is empty, so there's nothing to pick from yet.</p>}
          <button type="button" onClick={generate} disabled={!canGenerate}
            style={{ width: '100%', minHeight: 48, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: canGenerate ? 'pointer' : 'default', opacity: canGenerate ? 1 : 0.5 }}>
            {loading ? 'Loading exercises…' : `🔀 Fill ${dayIdxs.length || ''} day${dayIdxs.length === 1 ? '' : 's'} in week ${targetWeek}`}
          </button>
        </div>
      </div>
    </div>
  )
}
