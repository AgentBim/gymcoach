import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyInboxChanged } from '../hooks/useInboxCount'
import { Button, Dialog, Label } from './ui'

// One composer for every place the coach writes to an athlete: Today's Needs
// you, the Athlete hub, the Athletes bulk bar and the Inbox. In-app only for
// now; SMS and email are shown but switched off.
export default function ComposeDialog({ athletes, title, why, templates = [], initial = '', onClose, onSent }) {
  const [draft, setDraft] = useState(initial)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const many = athletes.length > 1
  const first = athletes[0]?.full_name.split(' ')[0]

  async function send() {
    setSending(true)
    setError('')
    const sent = []
    for (const a of athletes) {
      const { data, error: e } = await supabase.rpc('send_coach_message', { p_athlete_id: a.id, p_body: draft })
      if (e) { setError(`${a.full_name}: ${e.message}`); break }
      sent.push({ athleteId: a.id, id: data })
    }
    setSending(false)
    if (sent.length) { notifyInboxChanged(); onSent(sent, draft.trim()) }
    if (sent.length === athletes.length) onClose()
  }

  return (
    <Dialog title={title} subtitle={why} onClose={onClose} busy={sending}
      footer={<>
        <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--mu2)', minWidth: 160 }}>{many ? 'Each person gets their own copy.' : `You can unsend until ${first} opens it.`}</span>
        <Button onClick={onClose} disabled={sending}>Cancel</Button>
        <Button variant="primary" onClick={send} disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send in-app'}</Button>
      </>}>
      <div>
        <Label style={{ marginBottom: 8 }}>Send via</Label>
        <div role="group" aria-label="Channel" style={{ display: 'flex', border: '1px solid var(--br2)', borderRadius: 9, overflow: 'hidden' }}>
          {[['In-app', true], ['SMS', false], ['Email', false]].map(([l, on]) => (
            <button key={l} type="button" aria-pressed={on} disabled={!on} title={on ? undefined : 'Coming soon'}
              style={{ flex: 1, minHeight: 36, border: 'none', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? 'var(--ac)' : 'transparent', color: on ? 'var(--ac-ink)' : 'var(--mu)', cursor: on ? 'default' : 'not-allowed' }}>
              {l}{!on && <span style={{ fontSize: 10, marginLeft: 4 }}>soon</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--mu2)', marginTop: 6 }}>{many ? 'Shows in each athlete\'s portal inbox.' : `Shows in ${first}'s portal inbox.`}</p>
      </div>
      {templates.length > 0 && (
        <div>
          <Label style={{ marginBottom: 8 }}>Start from a template</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {templates.map(t => (
              <button key={t.label} type="button" onClick={() => setDraft(t.text)}
                style={{ minHeight: 36, padding: '0 12px', borderRadius: 16, border: '1px solid var(--br2)', background: 'transparent', color: 'var(--tx)', fontSize: 12.5, cursor: 'pointer' }}>{t.label}</button>
            ))}
          </div>
        </div>
      )}
      <textarea aria-label="Message" value={draft} onChange={e => setDraft(e.target.value)} rows={4} autoFocus
        style={{ width: '100%', minHeight: 100, resize: 'vertical', background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 12, color: 'var(--tx)', font: 'inherit', fontSize: 14, lineHeight: 1.5, padding: '10px 12px', outline: 'none' }} />
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
    </Dialog>
  )
}
