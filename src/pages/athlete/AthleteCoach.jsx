import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAthletePortal } from '../../hooks/useAthletePortal'
import { feelOf } from '../../lib/feel'
import { dayLabel } from '../../lib/dates'
import { Avatar, Button, Chip, Icon, Label } from '../../components/ui'

const QUICK = ['On it, starting soon', "Can't today, can we move it?", 'Quick question']
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

// Coach (mockup A7): the conversation with your coach, with your logged
// sessions and schedule changes in line.
export default function AthleteCoach() {
  const p = useAthletePortal()
  const { today } = p
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const coachFirst = p.coachName.split(' ')[0]

  // Opening the thread marks it read.
  useEffect(() => {
    if (p.coachUnread) supabase.rpc('mark_thread_read').then(() => p.refresh())
  }, [p.coachUnread])

  const items = [
    ...p.messages.map(m => ({ type: 'message', id: m.id, at: m.created_at, m })),
    ...p.feedback.slice(0, 20).map(f => ({ type: 'feedback', id: 'f' + f.id, at: f.submitted_at, f })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))
  // The page scrolls (the composer and tab bar are fixed), so go to the very bottom.
  useEffect(() => { window.scrollTo({ top: document.documentElement.scrollHeight }) }, [items.length])

  async function send(text) {
    const body = (text ?? draft).trim()
    if (!body) return
    setSending(true); setError('')
    const { error: e } = await supabase.rpc('send_athlete_message', { p_body: body })
    setSending(false)
    if (e) { setError(e.message); return }
    setDraft('')
    p.refresh()
  }

  let lastDay = ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 'calc(210px + env(safe-area-inset-bottom))' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '12px 16px', paddingTop: 'max(12px, calc(var(--sat) + 6px))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={p.coachName} size={40} />
        <div><h1 style={{ fontSize: 17, fontWeight: 700 }}>Coach {coachFirst}</h1><div style={{ fontSize: 12.5, color: 'var(--mu2)' }}>Messages show up here and in your portal</div></div>
      </header>

      <div style={{ flex: 1, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 && <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--mu2)', padding: 30 }}>No messages yet. Say hello to Coach {coachFirst}.</div>}
        {items.map(it => {
          const d = dayLabel(it.at.slice(0, 10), today)
          const head = d !== lastDay ? <div key={'d' + it.id} style={{ textAlign: 'center', margin: '6px 0' }}><Label>{d}</Label></div> : null
          lastDay = d
          let node
          if (it.type === 'feedback') {
            const f = it.f
            const feel = feelOf(f.emoji_rating)
            node = (
              <div style={{ alignSelf: 'flex-end', maxWidth: '86%', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--br2)', background: 'var(--s2)' }}>
                <Label style={{ marginBottom: 6 }}>You logged {f.workouts?.name || 'a workout'}</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: f.notes ? 6 : 0 }}>{feel && <Chip tone={feel.tone}>{feel.label}</Chip>}{f.rpe && <Chip tone="text" mono>RPE {f.rpe}</Chip>}</div>
                {f.notes && <div style={{ fontSize: 14, color: 'var(--mu2)', lineHeight: 1.5 }}>"{f.notes}"</div>}
              </div>
            )
          } else if (it.m.sender === 'system') {
            node = (
              <div style={{ alignSelf: 'center', textAlign: 'center', padding: '10px 14px', borderRadius: 14, border: '1px solid var(--br)', background: 'var(--s1)', maxWidth: '90%' }}>
                <Label style={{ color: '#4FB88A' }}>Schedule change</Label><div style={{ fontSize: 14, marginTop: 4 }}>{it.m.body}</div>
              </div>
            )
          } else {
            const mine = it.m.sender === 'athlete'
            const req = it.m.request_id ? p.requests.find(r => r.id === it.m.request_id) : null
            node = (
              <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ padding: '10px 14px', fontSize: 14.5, lineHeight: 1.5, borderRadius: 18, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6, background: mine ? 'var(--ac)' : 'var(--s2)', color: mine ? 'var(--ac-ink)' : 'var(--tx)' }}>{it.m.body}</div>
                <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>{timeOf(it.at)}{req ? ` · ${req.status === 'pending' ? 'Waiting for your coach' : req.status === 'approved' ? 'Approved' : 'Declined'}` : ''}</div>
              </div>
            )
          }
          return <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{head}{node}</div>
        })}
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(64px + env(safe-area-inset-bottom))', background: 'var(--s1)', borderTop: '1px solid var(--br)', padding: '10px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {QUICK.map(q => <button key={q} type="button" onClick={() => send(q)} disabled={sending} style={{ minHeight: 36, padding: '0 14px', borderRadius: 18, border: '1px solid var(--br2)', background: 'transparent', color: 'var(--tx)', fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer' }}>{q}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Message your coach" placeholder={`Message Coach ${coachFirst}`} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }}
              style={{ flex: 1, minHeight: 46, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 23, color: 'var(--tx)', padding: '0 16px', fontSize: 15, outline: 'none' }} />
            <Button variant="primary" aria-label="Send" onClick={() => send()} disabled={!draft.trim() || sending} style={{ width: 46, minHeight: 46, padding: 0, borderRadius: 23 }}><Icon name="send" size={20} /></Button>
          </div>
          {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
