import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import AssignModal from '../components/AssignModal'
import { ChalkUpLogo } from '../components/ChalkUpLogo'
import Layout from '../components/Layout'
import { Badge, Button, Card, Chip, EmptyState, IconButton, Input, Modal, Toast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const GROUP_OPTIONS = ['All', 'Arms', 'Back', 'Legs', 'Core', 'Shoulders']
const GROUP_TONES = { Arms: 'warning', Back: 'info', Legs: 'danger', Core: 'success', Shoulders: 'violet' }

function MuscleBadge({ group }) {
  return <Badge tone={GROUP_TONES[group]}>{group}</Badge>
}

export default function Dashboard() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningWorkout, setAssigningWorkout] = useState(null)
  const [sheetWorkout, setSheetWorkout] = useState(null)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('All')
  const [filterOpen, setFilterOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => { fetchWorkouts() }, [user])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function fetchWorkouts() {
    if (!user) return
    const { data, error } = await supabase
      .from('workouts')
      .select('*, workout_exercises(exercise_id, exercises(muscle_group)), workout_assignments(id, expires_at)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setNotice({ tone: 'error', message: error.message })
    setWorkouts(data || [])
    setLoading(false)
  }

  async function deleteWorkout(id) {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (error) { setNotice({ tone: 'error', message: error.message }); return }
    setWorkouts(current => current.filter(workout => workout.id !== id))
    setNotice({ tone: 'success', message: 'Workout deleted.' })
  }

  async function duplicateWorkout(workout) {
    const { error } = await supabase.rpc('duplicate_workout', { p_workout_id: workout.id })
    if (error) {
      setNotice({ tone: 'error', message: `Workout could not be duplicated. ${error.message}` })
      return
    }
    await fetchWorkouts()
    setNotice({ tone: 'success', message: 'Workout duplicated.' })
  }

  function getMuscleGroups(workout) {
    return [...new Set(workout.workout_exercises?.map(item => item.exercises?.muscle_group).filter(Boolean))]
  }

  const filteredWorkouts = workouts.filter(workout => {
    if (search && !workout.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterGroup !== 'All' && !getMuscleGroups(workout).includes(filterGroup)) return false
    return true
  })

  if (loading) return <Layout><div className="cu-container cu-page" role="status">Loading workouts…</div></Layout>

  return (
    <Layout>
      {isMobile && (
        <header className="dashboard-mobile-header">
          <div className="dashboard-mobile-header__row">
            <ChalkUpLogo size={26} />
            <span className="dashboard-mobile-header__brand">ChalkUp</span>
            <IconButton variant="secondary" label={filterOpen ? 'Close workout filters' : 'Search and filter workouts'} onClick={() => setFilterOpen(open => !open)}>
              <AppIcon name={filterOpen ? 'close' : 'search'} />
            </IconButton>
            <Button onClick={() => navigate('/workout/new')}><AppIcon name="plus" /> New</Button>
          </div>
          {filterOpen && <WorkoutFilters search={search} setSearch={setSearch} filterGroup={filterGroup} setFilterGroup={setFilterGroup} />}
        </header>
      )}

      <div className="dashboard-content">
        <header className="dashboard-toolbar">
          <div>
            <h1 className="cu-display">My workouts</h1>
            <p className="dashboard-subtitle">{filteredWorkouts.length} of {workouts.length} workouts</p>
          </div>
          {!isMobile && <Button onClick={() => navigate('/workout/new')}><AppIcon name="plus" /> New workout</Button>}
        </header>

        {!isMobile && <WorkoutFilters search={search} setSearch={setSearch} filterGroup={filterGroup} setFilterGroup={setFilterGroup} />}

        {workouts.length === 0 ? (
          <EmptyState>
            <div className="dashboard-empty-copy">
              <AppIcon name="workout" size={36} />
              <h2>No workouts yet</h2>
              <p>Build your first workout manually or start with the randomizer.</p>
              <Button onClick={() => navigate('/workout/new')}>Create workout</Button>
            </div>
          </EmptyState>
        ) : filteredWorkouts.length === 0 ? (
          <EmptyState>
            <div className="dashboard-empty-copy">
              <AppIcon name="search" size={34} />
              <h2>No matching workouts</h2>
              <p>Try another search term or clear the muscle-group filter.</p>
              <Button variant="secondary" onClick={() => { setSearch(''); setFilterGroup('All') }}>Clear filters</Button>
            </div>
          </EmptyState>
        ) : (
          <div className="workout-grid">
            {filteredWorkouts.map(workout => (
              <WorkoutCard key={workout.id} workout={workout} isMobile={isMobile} muscleGroups={getMuscleGroups(workout)} onAssign={() => setAssigningWorkout(workout)} onMore={() => setSheetWorkout(workout)} onEdit={() => navigate(`/workout/${workout.id}/edit`)} onDuplicate={() => duplicateWorkout(workout)} onDelete={() => deleteWorkout(workout.id)} />
            ))}
            {!isMobile && (
              <button type="button" className="create-workout-card" onClick={() => navigate('/workout/new')}>
                <span><span className="create-workout-card__icon"><AppIcon name="plus" /></span>Create new workout</span>
              </button>
            )}
          </div>
        )}
      </div>

      {assigningWorkout && <AssignModal workout={assigningWorkout} onAssigned={count => setNotice({ tone: 'success', message: `Workout assigned to ${count} athlete${count === 1 ? '' : 's'}.` })} onError={message => setNotice({ tone: 'error', message })} onClose={() => { setAssigningWorkout(null); fetchWorkouts() }} />}
      {sheetWorkout && <WorkoutActionSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} onEdit={() => { setSheetWorkout(null); navigate(`/workout/${sheetWorkout.id}/edit`) }} onDuplicate={() => { duplicateWorkout(sheetWorkout); setSheetWorkout(null) }} onAssign={() => { setAssigningWorkout(sheetWorkout); setSheetWorkout(null) }} onDelete={() => { deleteWorkout(sheetWorkout.id); setSheetWorkout(null) }} />}
      {notice && <Toast tone={notice.tone}>{notice.message}</Toast>}
    </Layout>
  )
}

function WorkoutFilters({ search, setSearch, filterGroup, setFilterGroup }) {
  return (
    <div className="dashboard-filters" role="search" aria-label="Filter workouts">
      <div className="dashboard-search">
        <AppIcon name="search" size={17} />
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search workouts" aria-label="Search workouts" />
      </div>
      <div className="dashboard-chips" aria-label="Muscle group">
        {GROUP_OPTIONS.map(group => <Chip key={group} selected={filterGroup === group} onClick={() => setFilterGroup(group)}>{group}</Chip>)}
      </div>
    </div>
  )
}

function WorkoutCard({ workout, isMobile, muscleGroups, onAssign, onMore, onEdit, onDuplicate, onDelete }) {
  const assignmentCount = workout.workout_assignments?.length || 0
  return (
    <Card className="workout-card">
      <div className="workout-card__header">
        <h2 className="workout-card__title">{workout.name}</h2>
        <Badge tone={assignmentCount ? 'success' : undefined}>{assignmentCount ? `${assignmentCount} assigned` : 'Unassigned'}</Badge>
      </div>
      <div className="workout-card__tags">{muscleGroups.map(group => <MuscleBadge key={group} group={group} />)}</div>
      <div className="workout-card__meta"><span><AppIcon name="workout" size={15} />{workout.workout_exercises?.length || 0} exercises</span></div>
      <div className="workout-card__actions">
        <Button variant="secondary" className="workout-card__assign" onClick={onAssign}><AppIcon name="share" size={17} /> Assign</Button>
        {isMobile ? <IconButton variant="secondary" label={`More actions for ${workout.name}`} onClick={onMore}><AppIcon name="more" /></IconButton> : (
          <div className="workout-card__desktop-actions">
            <IconButton variant="secondary" label={`Edit ${workout.name}`} onClick={onEdit}><AppIcon name="edit" /></IconButton>
            <IconButton variant="secondary" label={`Duplicate ${workout.name}`} onClick={onDuplicate}><AppIcon name="copy" /></IconButton>
            <IconButton variant="danger" label={`Delete ${workout.name}`} onClick={onDelete}><AppIcon name="trash" /></IconButton>
          </div>
        )}
      </div>
    </Card>
  )
}

function WorkoutActionSheet({ workout, onClose, onEdit, onDuplicate, onAssign, onDelete }) {
  return (
    <Modal labelledBy="workout-actions-title" onClose={onClose}>
      <div className="action-sheet__handle" />
      <div className="action-sheet__header">
        <h2 id="workout-actions-title">{workout.name}</h2>
        <p>{workout.workout_exercises?.length || 0} exercises</p>
      </div>
      <div className="action-sheet__grid">
        <Button variant="secondary" className="action-sheet__action" onClick={onEdit}><AppIcon name="edit" />Edit</Button>
        <Button variant="secondary" className="action-sheet__action" onClick={onDuplicate}><AppIcon name="copy" />Duplicate</Button>
        <Button variant="secondary" className="action-sheet__action" onClick={onAssign}><AppIcon name="share" />Assign</Button>
        <Button variant="danger" className="action-sheet__action" onClick={onDelete}><AppIcon name="trash" />Delete</Button>
      </div>
      <Button variant="secondary" className="action-sheet__cancel" onClick={onClose}>Cancel</Button>
    </Modal>
  )
}
