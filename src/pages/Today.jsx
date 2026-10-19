import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRoster } from '../lib/useRoster'
import { todayLocal } from '../lib/streaks'
import { feelOf } from '../lib/rosterStatus'
import { mondayOfStr } from '../lib/dates'
import ComposeDialog from '../components/ComposeDialog'
import { templatesFor } from '../lib/templates'
import { notifyInboxChanged } from '../hooks/useInboxCount'
import { Avatar, Button, Card, Chip, Dot, DotLegend, EmptyState, Icon, Label, SearchBox, StatCard, UndoToast } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''
}

const ACTION_FOR = { missed: 'Message', note: 'Reply', risk: 'Nudge' }
const VERB_FOR = { missed: 'Message', note: 'Reply to', risk: 'Nudge' }
const SECOND_FOR = { missed: 'Adjust week', note: 'Review' }

export default function Today() {
  const { user, coach } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { loading, rows, feedback, programs, reload } = useRoster(user?.id)
  const [workouts, setWorkouts] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [compose, setCompose] = useState(null) // { row, reason }
  const [sent, setSent] = useState({}) // athleteId -> messageId, sent this session
  const [toast, setToast] = useState(null)
  const today = todayLocal()

  useEffect(() => {
    if (!user) return
    supabase.from('workouts').select('id, name').eq('coach_id', user.id).eq('program_generated', false)
      .then(({ data }) => setWorkouts(data || []))
  }, [user])

  const first = coach?.full_name?.split(' ')[0] || 'Coach'
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // Open items, plus anything handled this session so it can still be unsent.
  const needs = rows
    .filter(r => r.needsAttention || sent[r.athlete.id])
    .map(r => ({ row: r, reason: r.reasons[0] }))
    .filter(x => x.reason)
  const open = needs.filter(x => !sent[x.row.athlete.id])

  async function unsend(athleteId) {
    const { error } = await supabase.rpc('unsend_message', { p_message_id: sent[athleteId] })
    setSent(s => { const n = { ...s }; delete n[athleteId]; return n })
    notifyInboxChanged()
    await reload()
    const name = rows.find(r => r.athlete.id === athleteId)?.athlete.full_name.split(' ')[0]
    setToast(error ? error.message : `Unsent. ${name} had not opened it.`)
  }
  // Athletes without a portal login can't log a session, so they aren't "due".
  const dueToday = rows.filter(r => r.todayDue && (r.athlete.user_id || r.todayLogged))
  const trainedToday = dueToday.filter(r => r.todayLogged).length
  const noProgram = rows.filter(r => r.noProgram)

  const completedToday = useMemo(
    () => feedback.filter(f => f.completed_date === today),
    [feedback, today]
  )
  const athleteById = useMemo(() => new Map(rows.map(r => [r.athlete.id, r.athlete])), [rows])

  const monday = mondayOfStr(today)
  const sunday = new Date(monday + 'T00:00:00'); sunday.setDate(sunday.getDate() + 6)
  const weekRange = `${new Date(monday + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.getDate()}`

  const needTone = open.length === 0 ? 'var(--teal)' : 'var(--coral)'

  const createItems = [
    { to: '/plan/workouts/new', label: 'New workout' },
    { to: '/plan/programs/new', label: 'New program' },
    { to: '/athletes/new', label: 'Add athlete' },
  ]

  // ── pieces ──
  const search = (
    <GlobalSearch athletes={rows.map(r => r.athlete)} programs={programs} workouts={workouts} />
  )

  const createMenu = (
    <div style={{ position: 'relative' }}>
      <Button variant="primary" icon="plus" onClick={() => setCreateOpen(o => !o)} aria-haspopup="menu" aria-expanded={createOpen}>Create</Button>
      {createOpen && (
        <>
          <div onClick={() => setCreateOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', right: 0, top: 42, minWidth: 180, zIndex: 41, background: 'var(--s2)', border: '1px solid var(--br2)', borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
            {createItems.map(i => (
              <Link key={i.to} to={i.to} role="menuitem" style={{ display: 'block', padding: '10px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>{i.label}</Link>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const header = isMobile ? (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <Label style={{ marginBottom: 4 }}>{dateLabel}</Label>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>{greeting()}, {first}</h1>
      </div>
      <Link to="/athletes" aria-label="Search athletes" style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 12, border: '1px solid var(--br2)', color: 'var(--mu2)', flexShrink: 0 }}>
        <Icon name="search" size={20} />
      </Link>
    </header>
  ) : (
    <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <Label style={{ marginBottom: 6 }}>{dateLabel}</Label>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 40, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1 }}>{greeting()}, {first}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{search}{createMenu}</div>
    </header>
  )

  const stats = (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 8 : 14 }}>
      <StatCard label={isMobile ? 'Trained' : 'Trained today'} value={trainedToday} note={`of ${dueToday.length}${isMobile ? '' : ' due'}`} />
      <StatCard label="Need you" value={open.length} tone={needTone} border={open.length ? 'rgba(226,105,90,.45)' : undefined} note={isMobile ? '' : open.length === 0 ? 'all handled' : 'missed, flagged or at risk'} to="/athletes" />
      <StatCard label="No program" value={noProgram.length} note={isMobile ? '' : 'athletes to assign'} to="/athletes" />
    </section>
  )

  const needsYou = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Needs you</h2>
        <Label>{open.length} left</Label>
      </div>
      {open.length === 0 && needs.length === 0 && (
        <EmptyState title="All clear for today">Everyone is either on track or has heard from you.</EmptyState>
      )}
      {needs.map(({ row, reason }) => {
        const done = !!sent[row.athlete.id]
        return (
          <div key={row.athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--br)', flexWrap: isMobile ? 'wrap' : 'nowrap', opacity: done ? 0.75 : 1 }}>
            <Avatar name={row.athlete.full_name} size={isMobile ? 40 : 36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {row.athlete.full_name}
                {reason.badge && <Chip mono>{reason.badge}</Chip>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 2, lineHeight: 1.4 }}>{reason.reason}</div>
            </div>
            {done ? (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4FB88A', fontWeight: 600 }}><Icon name="check" size={16} />Sent in-app</span>
                <Button size="sm" onClick={() => unsend(row.athlete.id)}>Unsend</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => setCompose({ row, reason })}>{ACTION_FOR[reason.kind]}</Button>
                {SECOND_FOR[reason.kind] && (
                  <Link to={`/athletes/${row.athlete.id}`} style={{ minHeight: isMobile ? 44 : 32, padding: '0 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, border: `1px solid ${reason.kind === 'note' ? 'var(--ac)' : 'var(--br2)'}`, background: reason.kind === 'note' ? 'var(--ac)' : 'transparent', color: reason.kind === 'note' ? 'var(--ac-ink)' : 'var(--tx)' }}>{SECOND_FOR[reason.kind]}</Link>
                )}
              </>
            )}
          </div>
        )
      })}
    </Card>
  )

  const completed = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Completed today</h2>
        <Link to="/athletes" style={{ fontSize: 12.5, color: 'var(--ac)' }}>All athletes</Link>
      </div>
      {completedToday.length === 0 && <EmptyState>Nothing logged yet today.</EmptyState>}
      {completedToday.map(f => {
        const a = athleteById.get(f.athlete_id)
        if (!a) return null
        const feel = feelOf(f.emoji_rating)
        return (
          <Link key={f.id} to={`/athletes/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--br)' }}>
            <Avatar name={a.full_name} size={isMobile ? 40 : 36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{a.full_name} <span style={{ fontWeight: 400, color: 'var(--mu2)' }}>finished {f.workouts?.name || 'a workout'}</span></div>
              {f.exercises_total > 0 && <div style={{ fontSize: 12.5, color: 'var(--mu2)', marginTop: 2 }}>{f.exercises_completed} of {f.exercises_total} exercises</div>}
            </div>
            {!isMobile && feel && <Chip tone={feel.tone}>{feel.label}</Chip>}
            {f.rpe && <Chip mono>RPE {f.rpe}</Chip>}
            {!isMobile && <span style={{ fontSize: 12, color: 'var(--mu)', minWidth: 56, textAlign: 'right' }}>{fmtTime(f.submitted_at)}</span>}
          </Link>
        )
      })}
    </Card>
  )

  const weekCard = !isMobile && (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>This week</h2>
        <Label>{weekRange}</Label>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 1fr) repeat(7, 22px)', gap: '10px 6px', alignItems: 'center' }}>
          <span />
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Label key={i} style={{ textAlign: 'center' }}>{d}</Label>)}
          {rows.map(r => (
            <WeekRow key={r.athlete.id} row={r} />
          ))}
        </div>
        <div style={{ marginTop: 14 }}><DotLegend /></div>
      </div>
    </Card>
  )

  const noProgramCard = noProgram.length > 0 && (
    <Card style={{ padding: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700 }}>{noProgram.length} athlete{noProgram.length === 1 ? ' has' : 's have'} no program</h2>
      <p style={{ fontSize: 13, color: 'var(--mu2)', margin: '6px 0 14px', lineHeight: 1.5 }}>Until one is assigned, every day counts as due for their streak.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={() => navigate('/athletes')}>Assign a program</Button>
        <Button onClick={() => navigate('/plan/programs')}>Browse programs</Button>
      </div>
    </Card>
  )

  return (
    <Layout>
      <div style={{ padding: isMobile ? 'max(18px, calc(var(--sat) + 10px)) 16px 24px' : '28px 36px 36px', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>
        {header}
        {loading ? (
          <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div>
        ) : (
          <>
            {stats}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
              <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {needsYou}
                {completed}
              </div>
              {!isMobile && (
                <div style={{ flex: '1 1 340px', maxWidth: 440, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {weekCard}
                  {noProgramCard}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isMobile && (
        <>
          <button aria-label="Create" aria-expanded={createOpen} onClick={() => setCreateOpen(o => !o)}
            style={{ position: 'fixed', right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', width: 56, height: 56, borderRadius: 18, border: 'none', background: 'var(--ac)', color: 'var(--ac-ink)', display: 'grid', placeItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.45)', zIndex: 60 }}>
            <Icon name="plus" size={26} strokeWidth={2.2} style={{ transform: createOpen ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {createOpen && (
            <>
              <div onClick={() => setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(9,13,14,.6)', zIndex: 55 }} />
              <div role="menu" aria-label="Create" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 56, background: 'var(--s1)', borderTop: '1px solid var(--br2)', borderRadius: '20px 20px 0 0', padding: '10px 16px calc(96px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#4A5559', margin: '0 auto 6px' }} />
                {createItems.map(i => (
                  <Link key={i.to} to={i.to} role="menuitem" style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 14px', border: '1px solid var(--br)', borderRadius: 12, fontSize: 15, fontWeight: 600 }}>{i.label}</Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {compose && (
        <ComposeDialog
          athletes={[compose.row.athlete]}
          title={`${VERB_FOR[compose.reason.kind]} ${compose.row.athlete.full_name}`}
          why={compose.reason.kind === 'missed' ? `${compose.reason.reason} Ask first, adjust second.` : compose.reason.reason}
          templates={templatesFor(compose.reason.kind === 'note' ? 'reply' : compose.reason.kind, compose.row.athlete, { streak: compose.row.streak })}
          initial={templatesFor(compose.reason.kind === 'note' ? 'reply' : compose.reason.kind, compose.row.athlete, { streak: compose.row.streak })[0].text}
          onClose={() => setCompose(null)}
          onSent={([m]) => { setSent(x => ({ ...x, [m.athleteId]: m.id })); setToast(`Sent in-app to ${compose.row.athlete.full_name}`); reload() }}
        />
      )}
      {toast && <UndoToast message={toast} onClose={() => setToast(null)} />}
    </Layout>
  )
}

function WeekRow({ row }) {
  return (
    <>
      <Link to={`/athletes/${row.athlete.id}`} style={{ fontSize: 13, color: 'var(--mu2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName(row.athlete.full_name)}</Link>
      {row.week.map((s, i) => (
        <span key={i} style={{ display: 'grid', placeItems: 'center' }}><Dot state={s} size={18} /></span>
      ))}
    </>
  )
}

function shortName(full) {
  const [f, ...rest] = (full || '').split(' ')
  const l = rest.pop()
  return l ? `${f} ${l[0]}.` : f
}

function GlobalSearch({ athletes, programs, workouts }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const term = q.trim().toLowerCase()
  const hits = term
    ? [
        ...athletes.map(a => ({ name: a.full_name, kind: 'Athlete', href: `/athletes/${a.id}` })),
        ...programs.map(p => ({ name: p.name, kind: 'Program', href: `/plan/programs/${p.id}` })),
        ...workouts.map(w => ({ name: w.name, kind: 'Workout', href: `/plan/workouts/${w.id}/edit` })),
      ].filter(h => h.name.toLowerCase().includes(term)).slice(0, 6)
    : []

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SearchBox value={q} onChange={v => { setQ(v); setOpen(true) }} placeholder="Search athletes, workouts" label="Search athletes, programs and workouts" style={{ width: 260 }} />
      {open && term && (
        <div role="listbox" aria-label="Search results" style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 41, background: 'var(--s2)', border: '1px solid var(--br2)', borderRadius: 10, padding: 4, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
          {hits.length === 0 && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--mu2)' }}>No matches.</div>}
          {hits.map(h => (
            <Link key={h.kind + h.href} to={h.href} role="option" onClick={() => setOpen(false)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 8, fontSize: 13.5 }}>
              <span>{h.name}</span><Label>{h.kind}</Label>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
