import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useIsMobile'
import { DAY_TYPE_COLORS } from '../lib/theme'
import { DAYS, cellKey, copyWeeks, weekHasDays } from '../lib/programGenerator'

// Saved workout rows -> the draft/save_workout item shape ('' for no reps or
// no duration), in position order.
function toItems(rows) {
  return [...(rows || [])]
    .sort((a, b) => a.position - b.position)
    .map(r => ({
      exercise_id: r.exercise_id,
      position: r.position,
      sets: r.sets,
      reps: r.reps ?? '',
      duration_seconds: r.duration_seconds ?? '',
      rest_seconds: r.rest_seconds,
    }))
}

function Segmented({ options, value, onChange, tall }) {
  return (
    <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)' }}>
      {options.map(([id, label]) => {
        const on = value === id
        return (
          <button key={id} type="button" aria-pressed={on} onClick={() => onChange(id)}
            style={{ flex: 1, minHeight: tall ? 44 : 40, borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? 'var(--br)' : 'transparent', color: on ? 'var(--tx)' : 'var(--mu)' }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

// "Copy weeks" (mockup screen of the same name). Draft-first like every
// program tool: onApply({ days, draftWorkouts }) hands the parent the next
// draft, and the parent snapshots before applying so it can be undone.
export default function CopyWeeksModal({ programName, weeks, initialSource, days, draftWorkouts, onClose, onApply }) {
  const isMobile = useIsMobile()
  const [source, setSource] = useState(() => {
    if (weekHasDays(days, initialSource)) return initialSource
    return Array.from({ length: weeks }, (_, i) => i + 1).find(w => weekHasDays(days, w)) || initialSource
  })
  const [targets, setTargets] = useState([])
  const [mode, setMode] = useState('link')
  const [progress, setProgress] = useState(true)
  const [conflict, setConflict] = useState('replace')
  const [copyDayTypes, setCopyDayTypes] = useState(true)
  const [copyNotes, setCopyNotes] = useState(false)
  const [savedContent, setSavedContent] = useState({})
  const [loadError, setLoadError] = useState('')

  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1)
  const sourceCells = DAYS.map((_, d) => days[cellKey(source, d)] || null)
  const sourceHasDays = sourceCells.some(Boolean)
  const activeTargets = targets.filter(t => t !== source && t <= weeks)

  // Clone copies a saved workout's contents, so fetch the ones in the source
  // week (once each) as soon as clone mode needs them.
  const savedIds = [...new Set(sourceCells.filter(c => c?.workout_id && !c.workout_ref).map(c => c.workout_id))]
  const missingIds = savedIds.filter(id => !savedContent[id])
  useEffect(() => {
    if (mode !== 'clone' || !missingIds.length) return
    let cancelled = false
    setLoadError('')
    supabase
      .from('workouts')
      .select('id, name, workout_exercises(exercise_id, position, sets, reps, duration_seconds, rest_seconds), workout_prehab(exercise_id, position, sets, reps, duration_seconds, rest_seconds)')
      .in('id', missingIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setLoadError(error.message); return }
        if ((data || []).length < missingIds.length) setLoadError(`Some workouts in week ${source} couldn't be loaded, so they can't be cloned. Try Link instead.`)
        setSavedContent(prev => ({
          ...prev,
          ...Object.fromEntries((data || []).map(w => [w.id, { name: w.name, exercises: toItems(w.workout_exercises), prehab: toItems(w.workout_prehab) }])),
        }))
      })
    return () => { cancelled = true }
  }, [mode, missingIds.join(',')])

  const result = useMemo(
    () => copyWeeks({ days, draftWorkouts }, { source, targets: activeTargets, mode, conflict, copyDayTypes, copyNotes, progress }, savedContent),
    [days, draftWorkouts, source, activeTargets.join(','), mode, conflict, copyDayTypes, copyNotes, progress, savedContent]
  )
  const { stats } = result
  const filledTargets = activeTargets.filter(t => weekHasDays(days, t))
  const waitingForContent = mode === 'clone' && stats.missingContent
  const canCopy = sourceHasDays && stats.daysWritten > 0 && !waitingForContent

  function pickSource(w) {
    setSource(w)
    setTargets(prev => prev.filter(t => t !== w))
  }

  function toggleTarget(w) {
    setTargets(prev => (prev.includes(w) ? prev.filter(t => t !== w) : [...prev, w]))
  }

  function apply() {
    if (!canCopy) return
    onApply({ days: result.days, draftWorkouts: result.draftWorkouts })
  }

  const counts = sourceCells.reduce((acc, c) => {
    if (!c) return acc
    if (c.day_type === 'training') acc.training += 1
    else acc[c.day_type] = (acc[c.day_type] || 0) + 1
    return acc
  }, { training: 0 })
  const sourceSummary = sourceHasDays
    ? [
        `${counts.training} training day${counts.training === 1 ? '' : 's'}`,
        ...['recovery', 'rest', 'competition'].filter(t => counts[t]).map(t => `${counts[t]} ${t} day${counts[t] === 1 ? '' : 's'}`),
      ].join(' · ')
    : 'This week is empty. Pick a week that has days to copy.'

  const weekList = names => names.map(w => `Week ${w}`).join(', ')
  const warningText = !filledTargets.length ? '' : conflict === 'replace'
    ? `${weekList(filledTargets)} already ${filledTargets.length === 1 ? 'has' : 'have'} days. ${filledTargets.length === 1 ? 'It is' : 'They are'} replaced in the draft, and Undo brings ${filledTargets.length === 1 ? 'it' : 'them'} back.`
    : `${weekList(filledTargets)} already ${filledTargets.length === 1 ? 'has' : 'have'} days. Only ${filledTargets.length === 1 ? 'its' : 'their'} empty days are filled.`

  const cols = Math.min(weeks, weeks > 8 ? 6 : 8)
  const label = { fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }
  const weekButton = (on, extra = {}) => ({
    position: 'relative', minHeight: 44, borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, padding: 0,
    background: on ? 'rgba(199,228,92,.14)' : 'transparent', color: on ? 'var(--ac)' : 'var(--tx)',
    border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}`, ...extra,
  })

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Copy weeks" onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 480, maxWidth: '100%', maxHeight: isMobile ? '100%' : '88vh', display: 'flex', flexDirection: 'column', background: 'var(--s1)', border: isMobile ? 'none' : '1px solid var(--br)', borderRadius: isMobile ? 0 : 14, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 12px', paddingTop: isMobile ? 'max(14px, calc(var(--sat) + 8px))' : 18, borderBottom: '1px solid var(--br)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)' }}>Copy weeks</div>
            <p style={{ fontSize: 11.5, color: 'var(--mu)', margin: '4px 0 0' }}>{programName.trim() || 'Program'} · {weeks} week{weeks === 1 ? '' : 's'} · nothing is saved until you press Save</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, flexShrink: 0, margin: '-8px -8px 0 0', background: 'none', border: 'none', color: 'var(--mu)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section>
            <div style={label}>Copy from</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 5 }}>
              {weekNumbers.map(w => {
                const hasDays = weekHasDays(days, w)
                return (
                  <button key={w} type="button" aria-pressed={w === source} disabled={!hasDays} onClick={() => pickSource(w)}
                    aria-label={hasDays ? `Copy from week ${w}` : `Week ${w} is empty`}
                    style={weekButton(w === source, { opacity: hasDays ? 1 : 0.4, cursor: hasDays ? 'pointer' : 'default' })}>
                    W{w}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 8 }}>
                {DAYS.map((day, d) => {
                  const c = sourceCells[d]
                  const dt = c ? DAY_TYPE_COLORS[c.day_type] : null
                  return (
                    <span key={day} title={c ? dt.label : 'Empty'}
                      style={{ height: 36, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, background: c ? dt.bg : 'transparent', border: c ? '1px solid transparent' : '1px dashed var(--br)' }}>
                      <span style={{ fontSize: 9.5, color: 'var(--mu)' }}>{day}</span>
                      <span style={{ fontSize: 11 }}>{c ? dt.icon : ''}</span>
                    </span>
                  )
                })}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>{sourceSummary}</span>
            </div>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={label}>Copy to</div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--mu)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#E7A23E' }} />already has days
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 5 }}>
              {weekNumbers.map(w => {
                const isSource = w === source
                const on = activeTargets.includes(w)
                return (
                  <button key={w} type="button" aria-pressed={on} disabled={isSource} onClick={() => toggleTarget(w)}
                    aria-label={isSource ? `Week ${w}, the source` : `Copy to week ${w}${weekHasDays(days, w) ? ' (already has days)' : ''}`}
                    style={weekButton(on, isSource ? { color: 'var(--mu)', borderStyle: 'dashed', opacity: 0.6, cursor: 'default' } : {})}>
                    {isSource ? 'SRC' : `W${w}`}
                    {!isSource && weekHasDays(days, w) && <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, background: '#E7A23E' }} />}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {[
                [`All after W${source}`, () => setTargets(weekNumbers.filter(w => w > source))],
                ['Every other week', () => setTargets(weekNumbers.filter(w => w !== source && (w - source) % 2 === 0))],
                ['Clear', () => setTargets([])],
              ].map(([text, action]) => (
                <button key={text} type="button" onClick={action}
                  style={{ minHeight: isMobile ? 44 : 36, padding: '0 12px', borderRadius: 22, background: 'transparent', border: '1px solid var(--br)', color: text === 'Clear' ? 'var(--mu)' : 'var(--tx)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {text}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div style={label}>How to copy</div>
            <Segmented options={[['link', 'Link'], ['clone', 'Clone']]} value={mode} onChange={setMode} tall={isMobile} />
            <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--tx)' }}>
                {mode === 'link'
                  ? `Target weeks use the same workouts as week ${source}. Edit one of them and every linked week changes too. No new workouts are created.`
                  : `Each target week gets its own copies of the workouts, so you can change or progress them without touching week ${source}.`}
              </span>
              {mode === 'clone' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '1px solid var(--br)' }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Progress the copies</span>
                    <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>+1 set per week after the source, up to 6</span>
                  </span>
                  <button type="button" role="switch" aria-checked={progress} aria-label="Progress the copies" onClick={() => setProgress(p => !p)}
                    style={{ width: 50, height: 30, flexShrink: 0, borderRadius: 15, border: 'none', padding: 3, cursor: 'pointer', display: 'flex', background: progress ? 'var(--ac)' : 'var(--br)' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 12, background: '#ECEEE9', marginLeft: progress ? 20 : 0, transition: 'margin .15s' }} />
                  </button>
                </div>
              )}
            </div>
          </section>

          <section>
            <div style={label}>If a week already has days</div>
            <Segmented options={[['replace', 'Replace'], ['fill', 'Only fill empty days']]} value={conflict} onChange={setConflict} tall={isMobile} />
            {warningText && (
              <div role="status" style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(231,162,62,.08)', border: '1px solid rgba(231,162,62,.3)' }}>
                <span style={{ color: '#E7A23E', fontSize: 14, lineHeight: 1.2 }}>⚠</span>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--tx)' }}>{warningText}</span>
              </div>
            )}
          </section>

          <section>
            <div style={label}>Also copy</div>
            <div style={{ borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={copyDayTypes} onChange={e => setCopyDayTypes(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ac)', flexShrink: 0 }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Rest, recovery and competition days</span>
                  <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>Off: only training days are copied</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, minHeight: 44, borderTop: '1px solid var(--br)', cursor: 'pointer' }}>
                <input type="checkbox" checked={copyNotes} onChange={e => setCopyNotes(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ac)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>Day notes</span>
              </label>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 12px)' : 16, borderTop: '1px solid var(--br)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loadError && mode === 'clone' ? (
              <span style={{ fontSize: 12, color: '#E2695A' }}>{loadError}</span>
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                  {stats.daysWritten ? `${stats.daysWritten} day${stats.daysWritten === 1 ? '' : 's'} across ${stats.weeksWritten} week${stats.weeksWritten === 1 ? '' : 's'}` : activeTargets.length ? 'Nothing to copy' : 'No target weeks yet'}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>
                  {waitingForContent ? 'Loading workouts to copy…' : stats.workoutsCreated ? `${stats.workoutsCreated} new program workout${stats.workoutsCreated === 1 ? '' : 's'} on save` : 'No new workouts'}
                </span>
              </>
            )}
          </div>
          <button type="button" onClick={apply} disabled={!canCopy}
            style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: canCopy ? 'pointer' : 'default',
              background: canCopy ? 'var(--ac)' : 'var(--br)', color: canCopy ? 'var(--ac-ink)' : 'var(--mu)' }}>
            {canCopy ? `Copy to ${stats.weeksWritten} week${stats.weeksWritten === 1 ? '' : 's'}` : 'Pick weeks'}
          </button>
        </div>
      </div>
    </div>
  )
}
