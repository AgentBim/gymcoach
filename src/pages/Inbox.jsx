import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import ComposeDialog from '../components/ComposeDialog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { notifyInboxChanged } from '../hooks/useInboxCount'
import { useIsMobile } from '../hooks/useIsMobile'
import { useInbox } from '../lib/useInbox'
import { loadAthleteSchedule, planFor } from '../lib/athleteSchedule'
import { templatesFor } from '../lib/templates'
import { todayLocal } from '../lib/streaks'
import { fmtShort, dayLabel } from '../lib/dates'
import { Avatar, Button, Card, Chip, EmptyState, Icon, Label, Page, PageHeader, Pill, PillRow, UndoToast } from '../components/ui'

const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
const stamp = (iso, today) => {
  const d = dayLabel(iso.slice(0, 10), today)
  return d === 'Today' ? timeOf(iso) : d
}

function ThreadRow({ t, on, onPick, today }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick}
      style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', border: 'none', borderTop: '1px solid var(--br)', background: on ? 'rgba(199,228,92,.07)' : 'transparent', textAlign: 'left', color: 'var(--tx)', cursor: 'pointer', minHeight: 76 }}>
      <Avatar name={t.athlete.full_name} size={40} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: t.unread ? 700 : 600 }}>{t.athlete.full_name}</span>
          {t.unread && <span role="img" aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: '#E2695A' }} />}
          {t.at && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--mu)' }}>{stamp(t.at, today)}</span>}
        </span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--mu2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.preview}</span>
        {t.request && <Chip tone="amber" style={{ marginTop: 6 }}>Schedule request</Chip>}
      </span>
    </button>
  )
}

function Bubble({ item, thread, today, onUnsend }) {
  if (item.type === 'feedback') {
    return (
      <div style={{ maxWidth: '80%', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--br2)', background: 'var(--s2)' }}>
        <Label style={{ marginBottom: 6 }}>{item.title}</Label>
        <div style={{ display: 'flex', gap: 6, marginBottom: item.note ? 6 : 0, flexWrap: 'wrap' }}>
          {item.rpe && <Chip tone="text" mono>RPE {item.rpe}</Chip>}
          {item.feel && <Chip tone={item.feel.tone}>{item.feel.label}</Chip>}
          {!item.rpe && !item.feel && <Chip>No rating</Chip>}
        </div>
        <div style={{ fontSize: 14, color: 'var(--mu2)', lineHeight: 1.5 }}>{item.note ? `"${item.note}"` : 'No note'}</div>
      </div>
    )
  }
  if (item.sender === 'system') {
    return <div style={{ width: '100%', textAlign: 'center', fontSize: 12.5, color: '#4FB88A', fontWeight: 600 }}>{item.body}</div>
  }
  const mine = item.sender === 'coach'
  const canUnsend = mine && new Date(item.at).getTime() > thread.athleteReadAt
  return (
    <div style={{ maxWidth: '76%', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ padding: '10px 14px', fontSize: 14, lineHeight: 1.5, borderRadius: 18, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6,
        background: mine ? 'var(--ac)' : 'var(--s2)', color: mine ? 'var(--ac-ink)' : 'var(--tx)' }}>
        {item.body}
        <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 4 }}>{stamp(item.at, today)}</div>
      </div>
      {item.request && item.request.status !== 'pending' && <div style={{ fontSize: 12, color: item.request.status === 'approved' ? '#4FB88A' : 'var(--mu2)', marginTop: 4 }}>{item.request.status === 'approved' ? 'Approved' : 'Declined'}</div>}
      {canUnsend && <button type="button" onClick={() => onUnsend(item)} style={{ background: 'none', border: 'none', color: 'var(--mu2)', fontSize: 12, cursor: 'pointer', padding: '4px 0', minHeight: 32 }}>Unsend</button>}
    </div>
  )
}

function ThreadView({ thread, today, onBack, onChanged, setToast }) {
  const isMobile = useIsMobile()
  const { athlete } = thread
  const first = athlete.full_name.split(' ')[0]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [schedule, setSchedule] = useState(null)
  const [busy, setBusy] = useState(false)
  const scroller = useRef(null)
  const req = thread.request

  useEffect(() => { setDraft('') }, [athlete.id])
  useEffect(() => { scroller.current?.scrollTo({ top: 1e6 }) }, [athlete.id, thread.items.length])
  useEffect(() => {
    setSchedule(null)
    if (req) loadAthleteSchedule(athlete.id).then(setSchedule)
  }, [athlete.id, req?.id])

  const fromPlan = schedule && req ? planFor(schedule, req.from_date) : null

  async function send() {
    setSending(true)
    const { data, error } = await supabase.rpc('send_coach_message', { p_athlete_id: athlete.id, p_body: draft })
    setSending(false)
    if (error) { setToast({ message: error.message }); return }
    setDraft('')
    notifyInboxChanged()
    await onChanged()
    setToast({ message: `Sent to ${athlete.full_name}`, undo: () => unsend(data) })
  }
  async function unsend(idOrItem) {
    const id = typeof idOrItem === 'string' ? idOrItem : idOrItem.id
    const { error } = await supabase.rpc('unsend_message', { p_message_id: id })
    notifyInboxChanged()
    await onChanged()
    setToast({ message: error ? error.message : `Unsent. ${first} had not opened it.` })
  }
  async function resolve(action) {
    setBusy(true)
    const { error } = await supabase.rpc('resolve_schedule_request', { p_request_id: req.id, p_action: action, p_workout_id: fromPlan?.workoutId || null, p_today: today })
    setBusy(false)
    if (error) { setToast({ message: error.message }); return }
    notifyInboxChanged()
    await onChanged()
    if (action === 'decline') {
      setDraft('I cannot move this one right now. Could you do it earlier in the week?')
      setToast({ message: 'Declined. Edit the reply, then send.' })
    } else setToast({ message: `Approved. ${athlete.full_name} has been told.` })
  }
  function suggest() {
    setDraft(`That day does not work for the schedule. Could you do ${req.to_date ? 'the day after' : 'another day'} instead?`)
  }

  const templates = templatesFor('inbox', athlete)
  const reqTitle = req ? `Move ${fmtShort(req.from_date)}${fromPlan?.name ? ` (${fromPlan.name})` : ''}${req.to_date ? ` to ${fmtShort(req.to_date)}` : ''}` : ''

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: isMobile ? 'none' : 1, minWidth: 0, minHeight: 420, height: isMobile ? 'calc(100dvh - 104px - env(safe-area-inset-bottom, 0px))' : 'calc(100vh - 134px)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--br)' }}>
        {onBack && <button type="button" onClick={onBack} aria-label="Back to inbox" style={{ width: 40, height: 40, background: 'none', border: 'none', color: 'var(--mu2)' }}><Icon name="back" size={22} /></button>}
        <Avatar name={athlete.full_name} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{athlete.full_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{athlete.group_name || 'Ungrouped'}</div>
        </div>
        <Link to={`/athletes/${athlete.id}`} style={{ fontSize: 13, fontWeight: 600, padding: '8px 12px', border: '1px solid var(--br2)', borderRadius: 8 }}>Open athlete</Link>
      </header>

      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
        {thread.items.length === 0 && <EmptyState>No messages yet. Say hello below.</EmptyState>}
        {thread.items.map(item => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', alignItems: item.sender === 'system' ? 'center' : item.type === 'feedback' || item.sender === 'athlete' ? 'flex-start' : 'flex-end' }}>
            <Bubble item={item} thread={thread} today={today} onUnsend={unsend} />
          </div>
        ))}
        {req && (
          <div style={{ padding: 14, borderRadius: 14, border: '1px solid rgba(231,162,62,.45)', background: 'rgba(231,162,62,.07)' }}>
            <Label style={{ color: '#E7A23E', marginBottom: 6 }}>Schedule request</Label>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }}>{reqTitle}</div>
            {req.note && <div style={{ fontSize: 13, color: 'var(--mu2)', marginTop: 4, lineHeight: 1.5 }}>"{req.note}"</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={() => resolve('approve')} disabled={busy || !req.to_date || !schedule}>Approve</Button>
              <Button onClick={suggest} disabled={busy}>Suggest another day</Button>
              <Button variant="danger" onClick={() => resolve('decline')} disabled={busy}>Decline</Button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--br)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {templates.map(t => <button key={t.label} type="button" onClick={() => setDraft(t.text)} style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, border: '1px solid var(--br2)', background: 'transparent', color: 'var(--tx)', fontSize: 12.5, cursor: 'pointer' }}>{t.label}</button>)}
        </div>
        <textarea aria-label="Reply" placeholder="Write a reply…" value={draft} onChange={e => setDraft(e.target.value)} rows={3}
          style={{ width: '100%', minHeight: 76, resize: 'none', background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 12, color: 'var(--tx)', font: 'inherit', fontSize: 14, lineHeight: 1.5, padding: '10px 12px', outline: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--mu2)' }}>Shows in {first}'s portal inbox.</span>
          <Button variant="primary" onClick={send} disabled={!draft.trim() || sending}>{sending ? 'Sending…' : 'Send in-app'}</Button>
        </div>
      </div>
    </Card>
  )
}

export default function Inbox() {
  const { athleteId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { loading, threads, reload } = useInbox(user?.id)
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState(null)
  const today = todayLocal()

  const unreadCount = threads.filter(t => t.unread).length
  const requestCount = threads.filter(t => t.request).length
  const shown = threads.filter(t => filter === 'all' || (filter === 'req' ? !!t.request : t.unread))

  const selectedId = athleteId || (!isMobile ? shown[0]?.athlete.id : null)
  const selected = threads.find(t => t.athlete.id === selectedId) || null

  // Opening a thread marks it read.
  useEffect(() => {
    if (!athleteId || !selected || !selected.unread) return
    supabase.rpc('mark_thread_read', { p_athlete_id: selected.athlete.id }).then(() => { notifyInboxChanged() })
  }, [athleteId, selected?.athlete.id, selected?.unread])

  const list = (
    <Card style={{ overflow: 'hidden', flex: isMobile ? 'none' : '1 1 320px', maxWidth: isMobile ? 'none' : 380, minWidth: isMobile ? 0 : 300, alignSelf: 'flex-start', width: isMobile ? '100%' : undefined }}>
      {shown.length === 0 && <EmptyState>Nothing here. You're caught up.</EmptyState>}
      {shown.map(t => <ThreadRow key={t.athlete.id} t={t} today={today} on={t.athlete.id === selectedId} onPick={() => navigate(`/inbox/${t.athlete.id}`)} />)}
    </Card>
  )

  const onChanged = () => reload()

  return (
    <Layout>
      <Page>
        {isMobile && selected ? (
          <ThreadView thread={selected} today={today} onBack={() => navigate('/inbox')} onChanged={onChanged} setToast={setToast} />
        ) : (
          <>
            <PageHeader eyebrow={`${unreadCount} unread · ${requestCount} request${requestCount === 1 ? '' : 's'}`} title="Inbox">
              <PillRow label="Filter">
                <Pill on={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
                <Pill on={filter === 'unread'} count={unreadCount} onClick={() => setFilter('unread')}>Unread</Pill>
                <Pill on={filter === 'req'} count={requestCount} onClick={() => setFilter('req')}>Requests</Pill>
              </PillRow>
            </PageHeader>
            {loading ? <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div> : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
                {list}
                {!isMobile && (selected
                  ? <ThreadView thread={selected} today={today} onChanged={onChanged} setToast={setToast} />
                  : <Card style={{ flex: '999 1 460px', display: 'grid', placeItems: 'center', minHeight: 300 }}><EmptyState>Pick a conversation.</EmptyState></Card>)}
              </div>
            )}
          </>
        )}
      </Page>
      {toast && <UndoToast message={toast.message} onUndo={toast.undo} onClose={() => setToast(null)} />}
    </Layout>
  )
}
