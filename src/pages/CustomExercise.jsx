import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCollectionLoad } from '../hooks/useCollectionLoad'
import Layout from '../components/Layout'
import PlanTabs from '../components/PlanTabs'
import UnsavedChanges from '../components/UnsavedChanges'
import { CollectionStatus } from '../components/CollectionLoading'
import { Button, Card, Page, PageHeader, Segmented } from '../components/ui'

const GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const DEFAULT = { name: '', description: '', muscle_group: 'Arms', difficulty: 'Medium', category: 'strength', prehab_focus: '', default_sets: 3, default_reps: 10, default_duration_seconds: '', default_rest_seconds: 60 }
const field = { width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, background: 'var(--bg)', border: '1px solid var(--br2)', borderRadius: 8, color: 'var(--tx)' }
const options = values => values.map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))

export default function CustomExercise() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(DEFAULT)
  const [timed, setTimed] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [error, setError] = useState('')
  const initialized = useRef(null)
  const load = useCallback(async signal => {
    if (!id) return null
    const { data, error } = await supabase.from('exercises').select('*').eq('id', id).eq('coach_id', user.id).eq('is_custom', true).single().abortSignal(signal)
    if (error || !data) throw new Error('Exercise unavailable')
    return data
  }, [id, user.id])
  const resource = useCollectionLoad(user.id + ':' + (id || 'new'), load, null)
  useEffect(() => {
    const key = id || 'new'
    if (!resource.hasData || initialized.current === key) return
    initialized.current = key
    setForm(resource.data || DEFAULT)
    setTimed(!!resource.data?.default_duration_seconds)
    setDirty(false)
  }, [id, resource.hasData, resource.data])
  useEffect(() => { if (savedId) navigate(`/plan/exercises?exercise=${encodeURIComponent(savedId)}`, { replace: true }) }, [savedId, navigate])
  function change(key, value) { setDirty(true); setForm(f => ({ ...f, [key]: value })) }
  async function save(e) {
    e.preventDefault()
    if (saving) return
    const dose = Number(timed ? form.default_duration_seconds : form.default_reps)
    const rest = Number(form.default_rest_seconds)
    if (!form.name.trim() || !Number.isInteger(Number(form.default_sets)) || Number(form.default_sets) < 1 || !Number.isInteger(dose) || dose < 1 || !Number.isInteger(rest) || rest < 0) {
      setError('Enter a name, at least one set, and a positive number of reps or seconds.'); return
    }
    setSaving(true); setError('')
    const payload = { name: form.name.trim(), description: (form.description || '').trim(), muscle_group: form.muscle_group, difficulty: form.difficulty,
      category: form.category, prehab_focus: form.category === 'prehab' ? form.prehab_focus || null : null,
      default_sets: Number(form.default_sets), default_reps: timed ? null : Number(form.default_reps), default_duration_seconds: timed ? Number(form.default_duration_seconds) : null,
      default_rest_seconds: Math.max(0, Number(form.default_rest_seconds) || 0), coach_id: user.id, is_custom: true }
    try {
      const query = id ? supabase.from('exercises').update(payload).eq('id', id).eq('coach_id', user.id) : supabase.from('exercises').insert(payload)
      const { data, error } = await query.select('id').single()
      if (error || !data) throw error || new Error('No exercise returned')
      setDirty(false); setSavedId(data.id)
    } catch { setError('Couldn’t save this exercise. Your changes are still here. Please try again.') }
    finally { setSaving(false) }
  }
  return <Layout><UnsavedChanges dirty={dirty} saving={saving} noun="exercise" /><PlanTabs /><Page style={{ maxWidth: 760, width: '100%', margin: '0 auto' }}>
    <PageHeader title={id ? 'Edit exercise' : 'New exercise'} eyebrow="Your exercise library" />
    <p style={{ color: 'var(--mu2)' }}>Add a coaching cue and check the default dose before saving. This exercise is visible only to you.</p>
    <CollectionStatus name="exercise" loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    {resource.hasData && <Card as="form" onSubmit={save} style={{ padding: 18 }}><fieldset disabled={saving} style={{ border: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label>Name <input required maxLength={160} value={form.name} onChange={e => change('name', e.target.value)} style={field} /></label>
      <label>Coaching cue <textarea value={form.description || ''} onChange={e => change('description', e.target.value)} placeholder="Describe the movement and what to focus on" style={{ ...field, minHeight: 100 }} /></label>
      <label>Muscle group <select value={form.muscle_group} onChange={e => change('muscle_group', e.target.value)} style={field}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label>
      <div><p>Type</p><Segmented label="Exercise type" options={options(['strength', 'prehab', 'mobility'])} value={form.category} onChange={v => change('category', v)} /></div>
      {form.category === 'prehab' && <label>Prehab focus <select value={form.prehab_focus || ''} onChange={e => change('prehab_focus', e.target.value)} style={field}><option value="">Not specified</option>{['activation', 'stability', 'mobility', 'strength'].map(v => <option key={v}>{v}</option>)}</select></label>}
      <div><p>Difficulty</p><Segmented label="Difficulty" options={options(['Easy', 'Medium', 'Hard'])} value={form.difficulty} onChange={v => change('difficulty', v)} /></div>
      <div><p>Measured by</p><Segmented label="Measured by" options={[{ value: 'reps', label: 'Reps' }, { value: 'time', label: 'Seconds' }]} value={timed ? 'time' : 'reps'} onChange={v => { setDirty(true); setTimed(v === 'time') }} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[['default_sets', 'Sets', 1], [timed ? 'default_duration_seconds' : 'default_reps', timed ? 'Seconds' : 'Reps', 1], ['default_rest_seconds', 'Rest (s)', 0]].map(([key, label, min]) => <label key={key}>{label}<input type="number" required min={min} step="1" value={form[key] ?? ''} onChange={e => change(key, e.target.value)} style={field} /></label>)}
      </div>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><Button disabled={saving} onClick={() => navigate('/plan/exercises')}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save exercise'}</Button></div>
    </fieldset></Card>}
  </Page></Layout>
}
