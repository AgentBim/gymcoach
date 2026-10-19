import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Avatar, Button, CheckRow, Dialog, EmptyState, Icon } from './ui'

// Assign a workout to athletes (mockup "Assign workout"): toggle who has it,
// Save applies the difference. mode="links" instead lists each assigned
// athlete's own share link to copy (assignment tokens are per athlete).
export default function AssignModal({ workout, mode = 'assign', onClose, onSaved }) {
  const { user } = useAuth()
  const [athletes, setAthletes] = useState([])
  const [existing, setExisting] = useState(new Map()) // athleteId -> { id, token }
  const [draft, setDraft] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    (async () => {
      const [{ data: aths }, { data: assigns }] = await Promise.all([
        supabase.from('athletes').select('id, full_name, group_name').eq('coach_id', user.id).order('full_name'),
        supabase.from('workout_assignments').select('id, athlete_id, assignment_token').eq('workout_id', workout.id).is('revoked_at', null),
      ])
      setAthletes(aths || [])
      const map = new Map((assigns || []).map(a => [a.athlete_id, { id: a.id, token: a.assignment_token }]))
      setExisting(map)
      setDraft(new Set(map.keys()))
    })()
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    const added = [...draft].filter(id => !existing.has(id))
    const removed = [...existing.keys()].filter(id => !draft.has(id))
    if (added.length) {
      const { error: e } = await supabase.from('workout_assignments')
        .upsert(added.map(athlete_id => ({ workout_id: workout.id, athlete_id, coach_id: user.id, revoked_at: null })), { onConflict: 'workout_id,athlete_id' })
      if (e) { setError(e.message); setSaving(false); return }
    }
    if (removed.length) {
      const { error: e } = await supabase.from('workout_assignments').delete().eq('workout_id', workout.id).in('athlete_id', removed)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved?.(draft.size, added.length || removed.length ? true : false)
    onClose()
  }

  function copy(athleteId) {
    const t = existing.get(athleteId)?.token
    if (!t) return
    navigator.clipboard.writeText(`${window.location.origin}/share/${t}`)
    setCopied(athleteId)
    setTimeout(() => setCopied(null), 2000)
  }

  if (mode === 'links') {
    const list = athletes.filter(a => existing.has(a.id))
    return (
      <Dialog title="Athlete links" subtitle={`${workout.name}. Each athlete has their own link.`} onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        {list.length === 0 && <EmptyState>Not assigned to anyone yet.</EmptyState>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: '1px solid var(--br2)', borderRadius: 12 }}>
              <Avatar name={a.full_name} size={28} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.full_name}</span>
              <Button size="sm" icon={copied === a.id ? 'check' : 'link'} onClick={() => copy(a.id)}>{copied === a.id ? 'Copied' : 'Copy link'}</Button>
            </div>
          ))}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={`Assign ${workout.name}`} subtitle="Pick who gets it. They see it in their portal today." onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {athletes.length === 0 && <EmptyState>No athletes yet. Add one from the Athletes page.</EmptyState>}
        {athletes.map(a => (
          <CheckRow key={a.id} checked={draft.has(a.id)} onChange={() => setDraft(d => { const n = new Set(d); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}>
            <Avatar name={a.full_name} size={28} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.full_name}</span>
            {a.group_name && <span style={{ fontSize: 12, color: 'var(--mu)' }}>{a.group_name}</span>}
          </CheckRow>
        ))}
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
    </Dialog>
  )
}
