import { useState, useMemo } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import DayFocusEditor from './DayFocusEditor'
import { MUSCLE_COLORS } from '../lib/theme'
import { DAYS, MUSCLE_GROUPS, SPLITS, cellKey, generateProgram, splitFocus, summarize } from '../lib/programGenerator'

const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const BLOCK_LETTERS = 'ABCDEFGHIJKL'
const DEFAULT_DAYS = [true, true, false, true, true, false, false]

// Preview cell tint and short label per focus preset.
const FOCUS_STYLE = {
  'Full body': { short: 'FB', bg: 'rgba(199,228,92,.18)', fg: '#C7E45C', bd: 'rgba(199,228,92,.35)' },
  Upper:       { short: 'U',  bg: 'rgba(107,169,222,.22)', fg: '#9CC6EC', bd: 'rgba(107,169,222,.35)' },
  Lower:       { short: 'L',  bg: 'rgba(226,105,90,.22)', fg: '#EE9A8F', bd: 'rgba(226,105,90,.35)' },
  Push:        { short: 'Pu', bg: 'rgba(161,132,227,.22)', fg: '#C3B1F0', bd: 'rgba(161,132,227,.35)' },
  Pull:        { short: 'Pl', bg: 'rgba(107,169,222,.22)', fg: '#9CC6EC', bd: 'rgba(107,169,222,.35)' },
  Legs:        { short: 'Lg', bg: 'rgba(226,105,90,.22)', fg: '#EE9A8F', bd: 'rgba(226,105,90,.35)' },
  Back:        { short: 'Bk', bg: 'rgba(107,169,222,.22)', fg: '#9CC6EC', bd: 'rgba(107,169,222,.35)' },
  Shoulders:   { short: 'Sh', bg: 'rgba(161,132,227,.22)', fg: '#C3B1F0', bd: 'rgba(161,132,227,.35)' },
  Arms:        { short: 'Ar', bg: 'rgba(231,162,62,.22)', fg: '#F0C07A', bd: 'rgba(231,162,62,.35)' },
  Core:        { short: 'Co', bg: 'rgba(79,184,138,.22)', fg: '#7FD0AC', bd: 'rgba(79,184,138,.35)' },
  Custom:      { short: 'C',  bg: 'rgba(140,151,146,.22)', fg: '#C6CCC9', bd: 'rgba(140,151,146,.35)' },
}
const focusStyle = preset => FOCUS_STYLE[preset] || FOCUS_STYLE.Custom

function weeksText(weeks) {
  if (weeks.length === 1) return `week ${weeks[0]}`
  const contiguous = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1)
  return contiguous ? `weeks ${weeks[0]}–${weeks[weeks.length - 1]}` : `weeks ${weeks.join(', ')}`
}

// A 50×30 switch inside a 44px-tall tap area.
function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      style={{ width: 50, height: 44, flexShrink: 0, border: 'none', padding: 0, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <span style={{ width: 50, height: 30, boxSizing: 'border-box', borderRadius: 15, padding: 3, display: 'flex', background: checked ? 'var(--ac)' : 'var(--br)' }}>
        <span style={{ width: 24, height: 24, borderRadius: 12, background: '#ECEEE9', marginLeft: checked ? 20 : 0, transition: 'margin .15s' }} />
      </span>
    </button>
  )
}

function Stepper({ value, label, onChange, min, max, tall }) {
  const btn = { width: tall ? 44 : 36, height: tall ? 44 : 36, borderRadius: 8, border: 'none', background: 'var(--br)', color: 'var(--tx)', fontSize: 16, cursor: 'pointer' }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} style={{ ...btn, opacity: value <= min ? 0.4 : 1 }}>−</button>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, minWidth: 28, textAlign: 'center', color: 'var(--tx)' }}>{value}</span>
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} style={{ ...btn, opacity: value >= max ? 0.4 : 1 }}>+</button>
    </span>
  )
}

function Segmented({ options, value, onChange, tall }) {
  return (
    <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--bg, #15191A)', border: '1px solid var(--br)' }}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
          style={{ flex: 1, minHeight: tall ? 44 : 36, padding: '0 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: value === id ? 'var(--br)' : 'transparent', color: value === id ? 'var(--tx)' : 'var(--mu)' }}>
          {text}
        </button>
      ))}
    </div>
  )
}

// "Generate full program" (mockup screens Generate full program, Day focus
// and Preview). Setup → Day focus (from a day's Edit) → Preview, where
// workouts can be rerolled or locked. Draft-only: onApply({ days,
// draftWorkouts, weeks }) hands the parent a whole new draft, which it
// snapshots first so Undo brings the old one back. pool is the exercise
// library, or null while it loads.
export default function FullProgramModal({ programName, initialWeeks, pool, poolError, onClose, onApply }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState('setup') // 'setup' | 'focus' | 'preview'
  const [focusDay, setFocusDay] = useState(null)
  const [split, setSplit] = useState('ul')
  const [trainingDays, setTrainingDays] = useState(DEFAULT_DAYS)
  const [offDays, setOffDays] = useState('recovery')
  const [dayFocus, setDayFocus] = useState(() => splitFocus('ul', DEFAULT_DAYS))
  const [weeks, setWeeks] = useState(initialWeeks)
  const [variation, setVariation] = useState('rotate')
  const [rotateEvery, setRotateEvery] = useState(4)
  const [progressionOn, setProgressionOn] = useState(true)
  const [progType, setProgType] = useState('sets')
  const [deloadOn, setDeloadOn] = useState(true)
  const [deloadEvery, setDeloadEvery] = useState(4)
  const [count, setCount] = useState(6)
  const [includePrehab, setIncludePrehab] = useState(true)
  const [result, setResult] = useState(null) // generateProgram output
  const [locked, setLocked] = useState(() => new Set()) // selection keys
  const [selected, setSelected] = useState(null) // cell key
  const [error, setError] = useState('')

  const poolById = useMemo(() => Object.fromEntries((pool || []).map(e => [e.id, e])), [pool])
  const trainingIdxs = DAYS.map((_, i) => i).filter(i => trainingDays[i])
  const config = {
    programName, weeks, trainingDays, offDays, dayFocus, count, includePrehab, variation, rotateEvery,
    progression: progressionOn ? progType : null,
    deloadEvery: deloadOn ? deloadEvery : null,
  }
  const workoutCount = trainingIdxs.length ? summarize(config) : 0
  const loading = !pool && !poolError
  const canPreview = trainingIdxs.length > 0 && pool && pool.length > 0

  function pickSplit(id) {
    setSplit(id)
    setDayFocus(splitFocus(id, trainingDays))
  }

  function toggleDay(i) {
    const next = trainingDays.map((on, j) => (j === i ? !on : on))
    setTrainingDays(next)
    setDayFocus(splitFocus(split, next))
  }

  // Keeps every existing pick whose day focus and size are unchanged, so
  // going back to setup to change e.g. progression keeps the exercises.
  function generate(reroll) {
    setError('')
    try {
      const next = generateProgram(config, pool, { previous: result?.selections, locked, reroll })
      setResult(next)
      return next
    } catch (err) {
      setError(err.message || 'Could not generate the program')
      return null
    }
  }

  function openPreview() {
    const next = generate(null)
    if (!next) return
    setStep('preview')
    if (!selected || !next.plan.cells[selected]) {
      const first = Object.entries(next.plan.cells).find(([, c]) => c.kind === 'training')
      setSelected(first ? first[0] : null)
    }
  }

  function toggleLock(selKey) {
    setLocked(prev => {
      const next = new Set(prev)
      if (next.has(selKey)) next.delete(selKey)
      else next.add(selKey)
      return next
    })
  }

  const label = { fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 8 }
  const card = { padding: 12, borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--br)' }

  // ── SETUP ──────────────────────────────────────────────────────
  const renderSetup = () => (
    <>
      <section>
        <div style={label}>Split</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SPLITS.map(s => {
            const on = s.id === split
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => pickSplit(s.id)}
                style={{ minHeight: isMobile ? 44 : 38, padding: '0 14px', borderRadius: 22, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  background: on ? 'rgba(199,228,92,.14)' : 'var(--s2)', color: on ? 'var(--ac)' : 'var(--tx)', border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}` }}>
                {s.label}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div style={label}>Training days</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={trainingDays[i]} onClick={() => toggleDay(i)}
              style={{ minHeight: 44, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
                background: trainingDays[i] ? 'rgba(199,228,92,.14)' : 'transparent', color: trainingDays[i] ? 'var(--ac)' : 'var(--mu)',
                border: `1px ${trainingDays[i] ? 'solid rgba(199,228,92,.45)' : 'dashed var(--br)'}` }}>
              {d}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--mu)' }}>Off days</span>
          <Segmented options={[['rest', 'All rest'], ['recovery', '1 recovery day']]} value={offDays} onChange={setOffDays} tall={isMobile} />
        </div>
      </section>

      {trainingIdxs.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={label}>Focus per day</div>
            <span style={{ fontSize: 11, color: 'var(--mu)' }}>Set by the split, editable</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {trainingIdxs.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 6px 12px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--br)' }}>
                <span style={{ width: 32, fontSize: 12.5, fontWeight: 600, color: 'var(--mu)' }}>{DAYS[d]}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{dayFocus[d]?.preset}</span>
                <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
                  {MUSCLE_GROUPS.map(g => (
                    <span key={g} style={{ width: 6, borderRadius: 2, height: Math.max(3, Math.round(((dayFocus[d]?.weights[g] || 0) / 100) * 22)), background: MUSCLE_COLORS[g].color }} />
                  ))}
                </span>
                <button type="button" onClick={() => { setFocusDay(d); setStep('focus') }} aria-label={`Edit ${FULL_DAYS[d]} focus`}
                  style={{ minHeight: isMobile ? 44 : 34, padding: '0 12px', borderRadius: 8, background: 'none', border: 'none', color: 'var(--ac)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {MUSCLE_GROUPS.map(g => (
              <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--mu)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: MUSCLE_COLORS[g].color }} />{g}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <div style={label}>Length</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--tx)' }}>Weeks</span>
          <Stepper value={weeks} label="weeks" min={1} max={12} onChange={setWeeks} tall={isMobile} />
        </div>
      </section>

      <section>
        <div style={label}>Variation across weeks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['repeat', 'Repeat', 'Week 1’s workouts are reused every week. Fewest workouts to manage.'],
            ['rotate', 'Rotate in blocks', 'Same exercises within a training block, new picks when the next block starts.'],
            ['fresh', 'Fresh every week', 'New exercise picks every week. Most variety, most workouts.'],
          ].map(([id, title, desc]) => {
            const on = variation === id
            return (
              <div key={id} style={{ ...card, background: on ? 'rgba(199,228,92,.06)' : 'var(--s2)', borderColor: on ? 'rgba(199,228,92,.4)' : 'var(--br)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button type="button" role="radio" aria-checked={on} onClick={() => setVariation(id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 0, background: 'none', border: 'none', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer', minHeight: 44 }}>
                  <span style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1, borderRadius: 10, boxSizing: 'border-box', border: `2px solid ${on ? 'var(--ac)' : 'var(--mu)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: on ? 'var(--ac)' : 'transparent' }} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.4 }}>{desc}</span>
                  </span>
                </button>
                {on && id === 'rotate' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 32 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--tx)' }}>New exercises every … weeks</span>
                    <Stepper value={rotateEvery} label="weeks per block" min={2} max={6} onChange={setRotateEvery} tall={isMobile} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div style={label}>Progression</div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>Progress each week</span>
              <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>Each week gets its own copy with more volume</span>
            </span>
            <Switch checked={progressionOn} onChange={setProgressionOn} label="Progress each week" />
          </div>
          {progressionOn && (
            <Segmented options={[['sets', '+1 set / week'], ['reps', '+2 reps / week']]} value={progType} onChange={setProgType} tall={isMobile} />
          )}
          <div style={{ height: 1, background: 'var(--br)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>Deload weeks</span>
              <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>About 60% of the usual sets</span>
            </span>
            <Switch checked={deloadOn} onChange={setDeloadOn} label="Deload weeks" />
          </div>
          {deloadOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--tx)' }}>Every … weeks (week {deloadEvery}, {deloadEvery * 2}, …)</span>
              <Stepper value={deloadEvery} label="weeks between deloads" min={3} max={8} onChange={setDeloadEvery} tall={isMobile} />
            </div>
          )}
        </div>
      </section>

      <section>
        <div style={label}>Each workout</div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--tx)' }}>Exercises</span>
            <Stepper value={count} label="exercises" min={2} max={10} onChange={setCount} tall={isMobile} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--tx)' }}>Prehab warm-up</span>
            <Switch checked={includePrehab} onChange={setIncludePrehab} label="Prehab warm-up" />
          </div>
        </div>
      </section>
    </>
  )

  // ── PREVIEW ────────────────────────────────────────────────────
  const plan = result?.plan
  const groups = !plan ? [] : variation === 'rotate'
    ? Array.from({ length: Math.ceil(weeks / rotateEvery) }, (_, b) => {
        const first = b * rotateEvery + 1
        const last = Math.min(weeks, first + rotateEvery - 1)
        return { id: b, label: `Block ${BLOCK_LETTERS[b]}`, range: `WEEKS ${first}–${last}`, weeks: Array.from({ length: last - first + 1 }, (_, i) => first + i) }
      })
    : [{ id: 'all', label: variation === 'repeat' ? 'Every week' : 'Week by week', range: `WEEKS 1–${weeks}`, weeks: Array.from({ length: weeks }, (_, i) => i + 1) }]

  function cellView(key) {
    const c = plan.cells[key]
    if (c.kind !== 'training') return { c }
    const preset = dayFocus[c.dayIdx]?.preset || 'Full body'
    const draft = result.draftWorkouts[result.days[key].workout_ref]
    return { c, preset, n: plan.focusN[c.dayIdx], draft, sets: draft?.exercises[0]?.sets, locked: locked.has(c.selKey) }
  }

  const renderPreview = () => {
    const presetsUsed = [...new Set(trainingIdxs.map(d => dayFocus[d]?.preset))]
    const sel = selected && plan.cells[selected] ? cellView(selected) : null
    return (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {presetsUsed.map(p => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mu)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: focusStyle(p).bd }} />{p}
            </span>
          ))}
          {offDays === 'recovery' && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mu)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(79,184,138,.3)' }} />Recovery</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mu)' }}><span style={{ width: 10, height: 10, borderRadius: 3, border: '1px dashed var(--br2)', boxSizing: 'border-box' }} />Rest</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>3× = sets</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, minmax(0, 1fr))', gap: 5 }}>
          <span />
          {DAY_LETTERS.map((d, i) => <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--mu)' }}>{d}</span>)}
        </div>

        {groups.map(g => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>{g.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mu)' }}>{g.range}</span>
              {variation === 'rotate' && (
                <button type="button" onClick={() => generate(new Set(Object.entries(plan.selections).filter(([, s]) => s.block === g.id).map(([k]) => k)))}
                  style={{ marginLeft: 'auto', minHeight: isMobile ? 44 : 32, padding: '0 12px', borderRadius: 20, background: 'transparent', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                  ↻ Reroll block
                </button>
              )}
            </div>
            {g.weeks.map(w => (
              <div key={w} style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, minmax(0, 1fr))', gap: 5, alignItems: 'center' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--tx)' }}>W{w}</span>
                  {deloadOn && w % deloadEvery === 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 600, color: '#6BA9DE' }}>DELOAD</span>}
                </span>
                {DAYS.map((_, d) => {
                  const key = cellKey(w, d)
                  const v = cellView(key)
                  const isSel = selected === key
                  if (v.c.kind !== 'training') {
                    const recovery = v.c.kind === 'recovery'
                    return (
                      <button key={d} type="button" onClick={() => setSelected(key)} aria-pressed={isSel} aria-label={`Week ${w} ${FULL_DAYS[d]} ${recovery ? 'recovery' : 'rest'}`}
                        style={{ height: 44, padding: 0, borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                          background: recovery ? 'rgba(79,184,138,.16)' : 'transparent', color: recovery ? '#4FB88A' : 'var(--mu)',
                          border: `${isSel ? 2 : 1}px ${isSel || recovery ? 'solid' : 'dashed'} ${isSel ? 'var(--ac)' : recovery ? 'rgba(79,184,138,.3)' : 'var(--br2)'}` }}>
                        {recovery ? 'R' : '·'}
                      </button>
                    )
                  }
                  const st = focusStyle(v.preset)
                  return (
                    <button key={d} type="button" onClick={() => setSelected(key)} aria-pressed={isSel}
                      aria-label={`Week ${w} ${FULL_DAYS[d]} ${v.preset} ${v.n}, ${v.sets} sets${v.c.deload ? ', deload' : ''}${v.locked ? ', locked' : ''}`}
                      style={{ position: 'relative', height: 44, padding: 0, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                        background: st.bg, color: st.fg, opacity: v.c.deload ? 0.75 : 1, border: `${isSel ? 2 : 1}px solid ${isSel ? 'var(--ac)' : st.bd}` }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{st.short}{v.n}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--tx)', opacity: 0.75 }}>{v.sets}×</span>
                      {v.locked && <span aria-hidden="true" style={{ position: 'absolute', top: 1, right: 3, fontSize: 8 }}>🔒</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ))}

        {sel && (
          <section aria-live="polite" style={{ ...card, background: 'var(--s1)', display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
            {sel.c.kind === 'training' ? (() => {
              const s = plan.selections[sel.c.selKey]
              const shared = s.weeks.length > 1
              const sub = [
                variation === 'fresh' ? 'New exercises every week.' : `Same exercises in ${weeksText(s.weeks)}${progressionOn ? ', with dosage changing week to week' : ''}${deloadOn && s.weeks.some(w => w % deloadEvery === 0) ? '; deload weeks are lighter' : ''}.`,
                sel.locked ? 'Locked: rerolls skip it.' : shared ? 'Rerolling changes it in all of those weeks.' : '',
              ].filter(Boolean).join(' ')
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mu)' }}>WEEK {sel.c.week} · {DAYS[sel.c.dayIdx].toUpperCase()}{sel.c.deload ? ' · DELOAD' : ''}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-head, sans-serif)', color: 'var(--tx)' }}>
                      {sel.preset} {sel.n}{variation === 'rotate' ? ` · Block ${BLOCK_LETTERS[sel.c.block]}` : ''}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.45 }}>{sub}</span>
                  </div>
                  <div>
                    {(sel.draft?.exercises || []).map((item, idx) => {
                      const ex = poolById[item.exercise_id]
                      const c = MUSCLE_COLORS[ex?.muscle_group] || { bg: 'var(--br)', color: 'var(--mu)' }
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--s2)' }}>
                          <span style={{ width: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{idx + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>{ex?.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.color, flexShrink: 0 }}>{ex?.muscle_group}</span>
                          <span style={{ width: 62, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--tx)', flexShrink: 0 }}>{item.sets} × {item.reps || `${item.duration_seconds}s`}</span>
                        </div>
                      )
                    })}
                    {sel.draft?.prehab?.length > 0 && (
                      <div style={{ padding: '8px 0 0', borderTop: '1px solid var(--s2)', fontSize: 11.5, color: 'var(--mu)' }}>
                        + prehab: {sel.draft.prehab.map(p => poolById[p.exercise_id]?.name).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => generate(new Set([sel.c.selKey]))} disabled={sel.locked}
                      style={{ flex: 1, minHeight: 44, borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 13, fontWeight: 600, cursor: sel.locked ? 'default' : 'pointer', opacity: sel.locked ? 0.45 : 1 }}>
                      ↻ Reroll this workout
                    </button>
                    <button type="button" onClick={() => toggleLock(sel.c.selKey)} aria-pressed={sel.locked}
                      style={{ minHeight: 44, padding: '0 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: sel.locked ? 'rgba(199,228,92,.14)' : 'var(--s2)', border: `1px solid ${sel.locked ? 'rgba(199,228,92,.45)' : 'var(--br)'}`, color: sel.locked ? 'var(--ac)' : 'var(--tx)' }}>
                      🔒 {sel.locked ? 'Locked' : 'Lock'}
                    </button>
                  </div>
                </>
              )
            })() : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mu)' }}>WEEK {sel.c.week} · {DAYS[sel.c.dayIdx].toUpperCase()}</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-head, sans-serif)', color: 'var(--tx)' }}>{sel.c.kind === 'recovery' ? 'Recovery day' : 'Rest day'}</span>
                <span style={{ fontSize: 12, color: 'var(--mu)' }}>No workout is created for this day.</span>
              </div>
            )}
          </section>
        )}
      </>
    )
  }

  // ── FRAME ──────────────────────────────────────────────────────
  const titles = {
    setup: ['Generate full program', 'STEP 1 OF 2 · SETUP'],
    focus: ['Day focus', 'WHAT EACH TRAINING DAY LEANS TOWARD'],
    preview: ['Preview', 'STEP 2 OF 2 · TAP A DAY'],
  }
  const [title, kicker] = titles[step]

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width: isMobile ? '100%' : 640, maxWidth: '100%', height: isMobile ? '100%' : '90vh', display: 'flex', flexDirection: 'column', background: 'var(--s1)', border: isMobile ? 'none' : '1px solid var(--br)', borderRadius: isMobile ? 0 : 14, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: isMobile ? 'max(10px, calc(var(--sat) + 6px))' : 12, borderBottom: '1px solid var(--br)' }}>
          {step !== 'setup' ? (
            <button type="button" onClick={() => setStep('setup')} aria-label="Back to setup"
              style={{ width: 44, height: 44, flexShrink: 0, background: 'none', border: 'none', color: 'var(--mu)', fontSize: 22, cursor: 'pointer' }}>‹</button>
          ) : <span style={{ width: 4 }} />}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-head, sans-serif)', color: 'var(--tx)' }}>{title}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mu)' }}>{kicker}</span>
          </div>
          {step === 'preview' && (
            <button type="button" onClick={() => generate('all')}
              style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--br)', color: 'var(--tx)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              ↻ Reroll all
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ width: 44, height: 44, flexShrink: 0, background: 'none', border: 'none', color: 'var(--mu)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: step === 'preview' ? 14 : 20 }}>
          {step === 'setup' && renderSetup()}
          {step === 'focus' && (
            <DayFocusEditor dayIdxs={trainingIdxs} focus={dayFocus} onChange={setDayFocus} count={count} initialDay={focusDay} />
          )}
          {step === 'preview' && plan && renderPreview()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 12px)' : 16, borderTop: '1px solid var(--br)' }}>
          {step === 'focus' ? (
            <button type="button" onClick={() => setStep('setup')}
              style={{ flex: 1, minHeight: 48, borderRadius: 10, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {error || poolError ? (
                  <span style={{ fontSize: 12, color: '#E2695A' }}>{error || poolError}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                      {step === 'preview' ? `${workoutCount} workouts across ${weeks} week${weeks === 1 ? '' : 's'}` : `${weeks} week${weeks === 1 ? '' : 's'} · ${trainingIdxs.length} training day${trainingIdxs.length === 1 ? '' : 's'}`}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>
                      {step === 'preview' ? 'Replaces the current draft · Undo available' : loading ? 'Loading exercises…' : `${workoutCount} program workout${workoutCount === 1 ? '' : 's'}, created on save`}
                    </span>
                  </>
                )}
              </div>
              {step === 'setup' ? (
                <button type="button" onClick={openPreview} disabled={!canPreview}
                  style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: canPreview ? 'pointer' : 'default',
                    background: canPreview ? 'var(--ac)' : 'var(--br)', color: canPreview ? 'var(--ac-ink)' : 'var(--mu)' }}>
                  Preview ›
                </button>
              ) : (
                <button type="button" onClick={() => onApply({ days: result.days, draftWorkouts: result.draftWorkouts, weeks })}
                  style={{ minHeight: 48, padding: '0 18px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, flexShrink: 0, cursor: 'pointer', background: 'var(--ac)', color: 'var(--ac-ink)' }}>
                  Apply to draft
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
