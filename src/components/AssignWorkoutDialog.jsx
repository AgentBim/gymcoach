import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Dialog, EmptyState } from './ui'

// Bulk "Assign workout": one workout to every selected athlete.
export default function AssignWorkoutDialog({ athletes, coachId, onClose, onDone }) {
  const [workouts, setWorkouts] = useState(null)
  const [pick, setPick] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('workouts').select('id, name, workout_exercises(id)')
      .eq('coach_id', coachId).eq('program_generated', false).is('archived_at', null).order('name')
      .then(({ data }) => setWorkouts(data || []))
  }, [])

  async function confirm() {
    setSaving(true)
    setError('')
    const { error: e } = await supabase.from('workout_assignments')
      .upsert(athletes.map(a => ({ workout_id: pick.id, athlete_id: a.id, coach_id: coachId, revoked_at: null })), { onConflict: 'workout_id,athlete_id' })
    setSaving(false)
    if (e) { setError(e.message); return }
    onDone(`${pick.name} assigned to ${athletes.length} athlete${athletes.length === 1 ? '' : 's'}`)
    onClose()
  }

  return (
    <Dialog title="Assign a workout" subtitle={`To ${athletes.map(a => a.full_name).join(', ')}. They see it in their portal today.`} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={confirm} disabled={!pick || saving}>{saving ? 'Assigning…' : 'Assign'}</Button></>}>
      <div role="radiogroup" aria-label="Workout" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workouts && workouts.length === 0 && <EmptyState>No workouts yet. Build one under Plan.</EmptyState>}
        {(workouts || []).map(w => {
          const on = pick?.id === w.id
          return (
            <button key={w.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(w)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', color: 'var(--tx)',
                border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br2)'}`, background: on ? 'rgba(199,228,92,.07)' : 'transparent' }}>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{w.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--mu2)' }}>{w.workout_exercises?.length || 0} exercises</span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: '#E2695A' }}>{error}</p>}
    </Dialog>
  )
}
