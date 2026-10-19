import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { useWorkoutPreview } from '../../lib/useWorkoutPreview'
import { readRun, runItems, runTotals, writeRun } from '../../lib/runState'
import { Button, Icon, Label } from '../../components/ui'

const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// The workout runner (mockup A3): tap a set when you finish it, rest starts
// by itself, the current exercise stays open.
export default function AthleteRun() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const p = useAthletePortal()
  const { workout, exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)
  const items = useMemo(() => runItems(exercises, prehabExercises), [exercises, prehabExercises])
  const [state, setState] = useState(() => readRun(p.athlete.id, p.today, workoutId))
  const [focus, setFocus] = useState(null)
  const [rest, setRest] = useState({ left: 0, total: 0 })
  const timer = useRef(null)

  useEffect(() => { writeRun(p.athlete.id, p.today, workoutId, state) }, [state])
  useEffect(() => () => clearInterval(timer.current), [])

  function startRest(sec) {
    clearInterval(timer.current)
    if (!sec) return
    setRest({ left: sec, total: sec })
    timer.current = setInterval(() => {
      setRest(r => {
        if (r.left <= 1) { clearInterval(timer.current); return { left: 0, total: 0 } }
        return { ...r, left: r.left - 1 }
      })
    }, 1000)
  }
  const stopRest = () => { clearInterval(timer.current); setRest({ left: 0, total: 0 }) }

  if (p.feedbackByDate.has(p.today)) return <Navigate to="/athlete" replace />
  if (loading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading…</div>
  if (!workout) return <div style={{ padding: 24, color: 'var(--mu2)' }}>Workout not found. <Link to="/athlete" style={{ color: 'var(--ac)' }}>Back to Today</Link></div>

  const count = it => Math.min(state.done[it.key] || 0, it.sets)
  const current = items.find(it => count(it) < it.sets)
  const openKey = focus || current?.key
  const t = runTotals(items, state.done)
  const allDone = t.totalSets > 0 && t.doneSets === t.totalSets

  function tapSet(it, n) {
    const c = count(it)
    if (n === c && c > 0) { setState(s => ({ ...s, done: { ...s.done, [it.key]: c - 1 } })); return } // undo the last one
    if (n !== c + 1) return
    setState(s => ({ ...s, done: { ...s.done, [it.key]: n } }))
    if (n < it.sets) { setFocus(it.key); startRest(it.rest) } else { setFocus(null); stopRest() }
  }

  const groupHead = (it, i) => {
    if (i > 0 && items[i - 1].group === it.group) return null
    const pre = it.group === 'Prehab'
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: pre || i === 0 ? '0 0 8px' : '12px 0 8px' }}>
        <Label style={{ color: pre ? '#4FB88A' : 'var(--ac)' }}>{pre ? 'Prehab first' : 'Main workout'}</Label>
        <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{pre ? `${items.filter(x => x.group === 'Prehab' && count(x) >= x.sets).length} of ${items.filter(x => x.group === 'Prehab').length} done` : `${t.mainDone} of ${t.mainTotal} sets`}</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '10px 14px 0', paddingTop: 'max(10px, calc(var(--sat) + 6px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/athlete" aria-label="Leave workout" style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'var(--mu2)' }}><Icon name="back" size={22} /></Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.name}</div>
            {p.program && <div style={{ fontSize: 12, color: 'var(--mu2)' }}>{p.program.name}</div>}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--mu2)' }}>{t.doneSets} / {t.totalSets} sets</span>
        </div>
        <div style={{ height: 4, background: 'var(--br)', margin: '10px -14px 0' }}><div style={{ height: '100%', width: `${t.totalSets ? (t.doneSets / t.totalSets) * 100 : 0}%`, background: 'var(--ac)', transition: 'width .3s' }} /></div>
      </header>

      <div style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', boxSizing: 'border-box', padding: `14px 14px ${rest.left ? 190 : 150}px` }}>
        {items.map((it, i) => {
          const c = count(it)
          const done = c >= it.sets
          const open = openKey === it.key
          return (
            <div key={it.key}>
              {groupHead(it, i)}
              {open ? (
                <div style={{ border: '1px solid rgba(199,228,92,.4)', background: 'var(--s2)', borderRadius: 16, padding: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{it.name}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--mu2)', margin: '3px 0 10px' }}>{it.dose}{it.rest ? ` · rest ${it.rest}s` : ''}</div>
                  {it.cue && <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--tx)', margin: '0 0 14px' }}>{it.cue}</p>}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Array.from({ length: it.sets }, (_, k) => k + 1).map(n => {
                      const isDone = n <= c
                      const isNext = n === c + 1
                      return (
                        <button key={n} type="button" aria-label={`Set ${n} ${isDone ? 'done' : isNext ? 'next' : 'locked'}`} onClick={() => tapSet(it, n)}
                          style={{ width: 56, height: 56, borderRadius: 14, fontSize: 18, fontWeight: 700, cursor: isDone || isNext ? 'pointer' : 'default',
                            border: `2px solid ${isDone ? 'var(--ac)' : isNext ? 'var(--ac)' : 'var(--br2)'}`, background: isDone ? 'var(--ac)' : 'transparent', color: isDone ? 'var(--ac-ink)' : isNext ? 'var(--ac)' : 'var(--mu)' }}>
                          {isDone ? <Icon name="check" size={22} strokeWidth={3} /> : n}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 12 }}>Tap a set when you finish it. Rest starts on its own.</div>
                </div>
              ) : (
                <button type="button" onClick={() => setFocus(it.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 14px', marginBottom: 8, borderRadius: 14, border: '1px solid var(--br)', background: 'var(--s1)', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer', opacity: done ? 0.6 : 1 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: done ? 'var(--ac)' : 'var(--s2)', color: done ? 'var(--ac-ink)' : 'var(--mu2)' }}>{done ? <Icon name="check" size={16} strokeWidth={3} /> : i + 1 - (it.group === 'Main' ? items.filter(x => x.group === 'Prehab').length : 0)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>{it.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mu2)' }}>{it.dose}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 4 }}>{Array.from({ length: it.sets }, (_, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: '50%', background: k < c ? 'var(--ac)' : 'var(--br2)' }} />)}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        {rest.left > 0 && (
          <div role="status" style={{ maxWidth: 600, margin: '0 auto', background: 'var(--s2)', borderTop: '1px solid var(--ac)', padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Label>Rest</Label><span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, flex: 1 }}>{mmss(rest.left)}</span>
              <Button size="sm" onClick={() => setRest(r => ({ left: r.left + 15, total: r.total + 15 }))}>+15s</Button>
              <Button size="sm" onClick={stopRest}>Skip</Button>
            </div>
            <div style={{ height: 3, background: 'var(--br)', borderRadius: 2, marginTop: 8 }}><div style={{ height: '100%', width: `${(rest.left / rest.total) * 100}%`, background: 'var(--ac)', borderRadius: 2, transition: 'width 1s linear' }} /></div>
          </div>
        )}
        <div style={{ background: 'var(--s1)', borderTop: '1px solid var(--br)', padding: '10px 16px calc(12px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <Button variant={allDone ? 'primary' : 'default'} onClick={() => navigate(`/athlete/finish/${workoutId}`)} style={{ width: '100%', minHeight: 52, fontSize: 15 }}>{allDone ? 'Finish workout' : 'Finish early'}</Button>
            <div style={{ fontSize: 12, color: 'var(--mu2)', textAlign: 'center', marginTop: 6 }}>
              {allDone ? 'All sets done. Nice work.' : `${t.doneSets} of ${t.totalSets} sets done. Finishing early still counts and tells your coach what you skipped.`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
