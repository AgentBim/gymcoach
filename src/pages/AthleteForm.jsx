import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Roster.css'

const LEVELS = ['Level 1','Level 2','Level 3','Level 4','Level 5','Level 6','Level 7','Level 8','Level 9','Level 10','Elite']

export default function AthleteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [group, setGroup] = useState('')
  const [level, setLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (isEdit) fetchAthlete() }, [id])
  async function fetchAthlete() {
    const { data, error: fetchError } = await supabase.from('athletes').select('*').eq('id', id).single()
    if (fetchError) { setError(fetchError.message); return }
    if (data) { setFullName(data.full_name); setGroup(data.group_name || ''); setLevel(data.level || ''); setNotes(data.notes || '') }
  }
  async function save(event) {
    event.preventDefault()
    if (!fullName.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const payload = { full_name: fullName.trim(), group_name: group.trim() || null, level: level || null, notes: notes.trim() || null, coach_id: user.id }
    const { error: saveError } = isEdit ? await supabase.from('athletes').update(payload).eq('id', id) : await supabase.from('athletes').insert(payload)
    if (saveError) { setError(saveError.message || 'Could not save athlete'); setSaving(false); return }
    navigate('/roster')
  }
  return (
    <Layout><div className="cu-container cu-page" style={{ maxWidth: 620 }}>
      <header className="cu-page-header"><div><p className="cu-label">Roster</p><h1 className="cu-display">{isEdit ? 'Edit athlete' : 'Add athlete'}</h1></div></header>
      <Card padded><form onSubmit={save} style={{ display:'grid', gap:'var(--space-4)' }}>
        <Field label="Full name *" htmlFor="athlete-name"><Input id="athlete-name" autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} required aria-invalid={Boolean(error && !fullName.trim())} /></Field>
        <div className="athlete-form-grid">
          <Field label="Group" htmlFor="athlete-group"><Input id="athlete-group" value={group} onChange={event => setGroup(event.target.value)} placeholder="Group A" /></Field>
          <Field label="Level" htmlFor="athlete-level"><Select id="athlete-level" value={level} onChange={event => setLevel(event.target.value)}><option value="">Select level</option>{LEVELS.map(item => <option key={item}>{item}</option>)}</Select></Field>
        </div>
        <Field label="Notes" htmlFor="athlete-notes"><Textarea id="athlete-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Injury history, focus areas, goals…" /></Field>
        {error && <Alert>{error}</Alert>}
        <div style={{ display:'flex', gap:'var(--space-2)' }}><Button variant="secondary" onClick={() => navigate('/roster')} style={{ flex:1 }}>Cancel</Button><Button type="submit" disabled={saving} style={{ flex:2 }}>{saving ? 'Saving…' : isEdit ? 'Update athlete' : 'Add to roster'}</Button></div>
      </form></Card>
    </div></Layout>
  )
}
