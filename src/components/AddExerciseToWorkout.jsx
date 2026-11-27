import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCollectionLoad } from '../hooks/useCollectionLoad'
import { CollectionStatus } from './CollectionLoading'
import { Button, Dialog } from './ui'

const EMPTY = []
export default function AddExerciseToWorkout({ exercise, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const load = useCallback(async signal => {
    const { data, error } = await supabase.from('workouts').select('id, name')
      .eq('coach_id', user.id).eq('program_generated', false).is('archived_at', null).order('name').abortSignal(signal)
    if (error) throw error
    return data || []
  }, [user.id])
  const { data, loading, hasData, error, reload } = useCollectionLoad(user.id, load, EMPTY)
  const open = path => navigate(`${path}?exercise=${encodeURIComponent(exercise.id)}`)
  return <Dialog title="Add to a workout" subtitle={`Choose where to add ${exercise.name}. Changes are saved in the workout builder.`} onClose={onClose}>
    <Button variant="primary" onClick={() => open('/plan/workouts/new')}>Create a new workout</Button>
    <CollectionStatus name="workouts" loading={loading} error={error} onRetry={reload} />
    {hasData && (data.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 14 }}>Or choose an existing workout</h3>
      {data.map(w => <Button key={w.id} onClick={() => open(`/plan/workouts/${w.id}/edit`)} style={{ whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start' }}>{w.name}</Button>)}
    </div> : <p>You have no standalone workouts yet. Create one above.</p>)}
  </Dialog>
}
