import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppIcon from '../components/AppIcon'
import Layout from '../components/Layout'
import { Alert, Badge, Button, Card, Chip, EmptyState, IconButton, Input, Toast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './Roster.css'

const initials = name => name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2)

export default function Roster() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterGroup, setFilterGroup] = useState('All')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { fetchAthletes() }, [user])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function fetchAthletes() {
    if (!user) return
    const { data, error: fetchError } = await supabase.from('athletes').select('*, workout_assignments(id)').eq('coach_id', user.id).order('group_name').order('full_name')
    if (fetchError) setError(fetchError.message || 'Could not load athletes')
    else setAthletes(data || [])
    setLoading(false)
  }

  async function deleteAthlete(athlete) {
    if (!window.confirm(`Remove ${athlete.full_name} from your roster? This cannot be undone.`)) return
    setError('')
    const { error: deleteError } = await supabase.from('athletes').delete().eq('id', athlete.id)
    if (deleteError) { setError(deleteError.message || 'Could not remove athlete'); return }
    setAthletes(current => current.filter(item => item.id !== athlete.id))
    setNotice('Athlete removed from roster.')
  }

  const groups = ['All', ...new Set(athletes.map(athlete => athlete.group_name).filter(Boolean))]
  const filtered = athletes.filter(athlete => (filterGroup === 'All' || athlete.group_name === filterGroup) && (!search || athlete.full_name.toLowerCase().includes(search.toLowerCase())))
  const grouped = filtered.reduce((result, athlete) => {
    const group = athlete.group_name || 'Ungrouped'
    result[group] ||= []
    result[group].push(athlete)
    return result
  }, {})

  return (
    <Layout>
      <div className="roster-page">
        <header className="roster-header">
          <div><h1 className="cu-display">Athlete roster</h1><p>{athletes.length} athletes</p></div>
          <Button onClick={() => navigate('/roster/new')}><AppIcon name="plus" /> Add athlete</Button>
        </header>
        {error && <Alert>{error}</Alert>}
        <div className="roster-filters" aria-label="Roster filters">
          <Input className="roster-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search athletes" aria-label="Search athletes" />
          {groups.map(group => <Chip key={group} selected={filterGroup === group} onClick={() => setFilterGroup(group)}>{group}</Chip>)}
        </div>
        {loading ? <div role="status">Loading athletes…</div> : athletes.length === 0 ? (
          <EmptyState><div><AppIcon name="roster" size={36} /><h2>No athletes yet</h2><p>Add your first athlete to start assigning workouts.</p><Button onClick={() => navigate('/roster/new')}>Add athlete</Button></div></EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState><div><h2>No matching athletes</h2><p>Try another name or group.</p><Button variant="secondary" onClick={() => { setSearch(''); setFilterGroup('All') }}>Clear filters</Button></div></EmptyState>
        ) : (
          <div className="roster-groups">
            {Object.entries(grouped).map(([group, members]) => (
              <section key={group} aria-labelledby={`group-${group.replace(/\W/g, '-')}`}>
                <h2 id={`group-${group.replace(/\W/g, '-')}`} className="roster-group__heading">{group} · {members.length}</h2>
                <div className="roster-list">
                  {members.map(athlete => <AthleteRow key={athlete.id} athlete={athlete} onView={() => navigate(`/roster/${athlete.id}`)} onEdit={() => navigate(`/roster/${athlete.id}/edit`)} onDelete={() => deleteAthlete(athlete)} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      {notice && <Toast>{notice}</Toast>}
    </Layout>
  )
}

function AthleteRow({ athlete, onView, onEdit, onDelete }) {
  const assignments = athlete.workout_assignments?.length || 0
  return (
    <Card className="athlete-row">
      <div className="athlete-avatar" aria-hidden="true">{initials(athlete.full_name)}</div>
      <div className="athlete-row__identity">
        <h3 className="athlete-row__name">{athlete.full_name}</h3>
        <div className="athlete-row__meta">{athlete.level && <Badge tone="info">{athlete.level}</Badge>}<span>{assignments} {assignments === 1 ? 'workout' : 'workouts'} assigned</span></div>
      </div>
      <div className="athlete-row__actions">
        <IconButton variant="secondary" label={`View ${athlete.full_name}`} onClick={onView}><AppIcon name="roster" /></IconButton>
        <IconButton variant="secondary" label={`Edit ${athlete.full_name}`} onClick={onEdit}><AppIcon name="edit" /></IconButton>
        <IconButton variant="danger" label={`Delete ${athlete.full_name}`} onClick={onDelete}><AppIcon name="trash" /></IconButton>
      </div>
    </Card>
  )
}
