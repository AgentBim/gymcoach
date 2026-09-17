import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const AV_COLORS = [
  { bg: 'rgba(80,150,230,.15)', color: '#6BB5F5' },
  { bg: 'rgba(50,200,140,.15)', color: '#5DD99A' },
  { bg: 'rgba(240,158,40,.15)', color: '#F4B455' },
  { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
  { bg: 'rgba(230,70,60,.15)', color: '#F88080' },
]

export default function AssignModal({ workout, onClose, onAssigned, onError }) {
  const { user } = useAuth()
  const [athletes, setAthletes] = useState([])
  const [selected, setSelected] = useState([])
  const [existing, setExisting] = useState([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [assignmentLinks, setAssignmentLinks] = useState({})
  const [copied, setCopied] = useState([])
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: aths }, { data: assigns }] = await Promise.all([
      supabase.from('athletes').select('*').eq('coach_id', user.id).order('group_name').order('full_name'),
      supabase.from('workout_assignments').select('athlete_id, assignment_token').eq('workout_id', workout.id),
    ])
    setAthletes(aths || [])
    setExisting((assigns || []).map(a => a.athlete_id))
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function assign() {
    if (selected.length === 0) return
    setSaving(true)
    setError('')
    const rows = selected.map(athlete_id => ({
      workout_id: workout.id, athlete_id, coach_id: user.id
    }))
    const { data: created, error: assignError } = await supabase
      .from('workout_assignments')
      .upsert(rows, { onConflict: 'workout_id,athlete_id' })
      .select('athlete_id, assignment_token')
    setSaving(false)
    if (assignError) {
      const message = assignError.message || 'Could not assign workout'
      setError(message)
      onError?.(message)
      return
    }
    setAssignmentLinks(Object.fromEntries((created || []).map(a => [a.athlete_id, a.assignment_token])))
    setDone(true)
    onAssigned?.(selected.length)
  }

  async function copyLink(athleteId) {
    const token = assignmentLinks[athleteId]
    if (!token) return
    const url = `${window.location.origin}/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(prev => [...prev, athleteId])
      setTimeout(() => setCopied(prev => prev.filter(id => id !== athleteId)), 2000)
    } catch { setError('Could not copy the athlete link. Check clipboard permissions and try again.') }
  }

  async function copyAll() {
    const lines = athletes
      .filter(a => selected.includes(a.id) && assignmentLinks[a.id])
      .map(a => `${a.full_name}: ${window.location.origin}/share/${assignmentLinks[a.id]}`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(selected)
      setTimeout(() => setCopied([]), 2000)
    } catch { setError('Could not copy the athlete links. Check clipboard permissions and try again.') }
  }

  const availableCount = athletes.filter(a => !existing.includes(a.id)).length
  const availableAthletes = athletes.filter(a => !existing.includes(a.id))
  const assignedAthletes = athletes.filter(a => existing.includes(a.id))

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
  const sheet = { background: 'var(--s1)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={sheet} role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--br)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span id="assign-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)' }}>Assign workout</span>
            <button onClick={onClose} aria-label="Close assignment dialog" style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 10 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--mu)' }}>{workout.name}</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {athletes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mu)', fontSize: 13 }}>
              No athletes in your roster yet.<br />Add athletes first from the Roster page.
            </div>
          ) : done ? (
            <div style={{ padding: '10px 0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 12 }}>
                Assigned to {selected.length} athlete{selected.length !== 1 ? 's' : ''} — copy their links
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {athletes.filter(a => selected.includes(a.id)).map(a => {
                  const av = AV_COLORS[a.full_name.charCodeAt(0) % AV_COLORS.length]
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 10 }}>
                      <div style={{ width: 30, height: 30, background: av.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: av.color, flexShrink: 0 }}>{initials(a.full_name)}</div>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--tx)' }}>{a.full_name}</span>
                      <button onClick={() => copyLink(a.id)} style={{ background: 'transparent', border: '1px solid var(--br)', borderRadius: 6, color: copied.includes(a.id) ? 'var(--ac)' : 'var(--mu)', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>
                        {copied.includes(a.id) ? '✓ Copied' : '🔗 Copy'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <button onClick={copyAll} style={{ width: '100%', padding: 11, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
                Copy all athlete links
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: 11, background: 'transparent', border: '1px solid var(--br)', borderRadius: 10, color: 'var(--mu)', fontSize: 13, cursor: 'pointer' }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }}>{availableCount === 0 ? 'Every athlete is already assigned to this workout.' : 'Select athletes to assign this workout to. Existing assignments cannot be selected again.'}</div>
              {availableAthletes.length > 0 && <AthleteSection title="Add more athletes" athletes={availableAthletes} selected={selected} onToggle={toggleSelect} />}
              {assignedAthletes.length > 0 && <AthleteSection title="Already assigned" athletes={assignedAthletes} selected={selected} onToggle={toggleSelect} disabled />}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && athletes.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--br)', flexShrink: 0 }}>
            {error && <p role="alert" style={{ color: '#F88080', fontSize: 12, marginBottom: 8 }}>{error}</p>}
            <button onClick={assign} disabled={saving || selected.length === 0}
              style={{ width: '100%', padding: 13, background: selected.length > 0 ? 'var(--ac)' : 'var(--br)', color: selected.length > 0 ? '#0C1118' : 'var(--mu)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: selected.length > 0 ? 'pointer' : 'default', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Assigning...' : selected.length > 0 ? `Assign to ${selected.length} athlete${selected.length !== 1 ? 's' : ''}` : 'Select athletes'}
            </button>
          </div>
        )}
        {done && error && <p role="alert" style={{ color: '#F88080', fontSize: 12, padding:'0 18px 12px' }}>{error}</p>}
      </div>
    </div>
  )
}

function AthleteSection({ title, athletes, selected, onToggle, disabled = false }) {
  const groups = athletes.reduce((result, athlete) => {
    const group = athlete.group_name || 'Ungrouped'
    result[group] ||= []
    result[group].push(athlete)
    return result
  }, {})
  return <section style={{ marginBottom:18 }} aria-labelledby={`assignment-${title.replace(/\W/g, '-').toLowerCase()}`}>
    <h3 id={`assignment-${title.replace(/\W/g, '-').toLowerCase()}`} style={{ margin:'0 0 10px', fontSize:12, color:disabled ? 'var(--chalk-faint)' : 'var(--chalk)', textTransform:'uppercase', letterSpacing:'.06em' }}>{title}</h3>
    {Object.entries(groups).map(([group, members]) => <div key={group} style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, color:'var(--mu)', marginBottom:6 }}>{group}</div>
      <div style={{ display:'grid', gap:6 }}>{members.map(athlete => {
        const avatar = AV_COLORS[athlete.full_name.charCodeAt(0) % AV_COLORS.length]
        const isSelected = selected.includes(athlete.id)
        return <button type="button" key={athlete.id} onClick={() => onToggle(athlete.id)} disabled={disabled} aria-pressed={isSelected} style={{ width:'100%', minHeight:48, display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:isSelected ? 'rgba(199,228,92,.08)' : 'var(--s2)', border:`1px solid ${isSelected ? 'rgba(199,228,92,.35)' : 'var(--br)'}`, borderRadius:10, color:'inherit', opacity:disabled ? .65 : 1, textAlign:'left' }}>
          <span aria-hidden="true" style={{ width:18, height:18, display:'grid', placeItems:'center', borderRadius:5, background:isSelected || disabled ? 'var(--ac)' : 'var(--br)', color:'var(--accent-ink)' }}>{isSelected || disabled ? '✓' : ''}</span>
          <span aria-hidden="true" style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:'50%', background:avatar.bg, color:avatar.color, fontSize:11 }}>{initials(athlete.full_name)}</span>
          <span style={{ flex:1 }}>{athlete.full_name}</span>
          {athlete.level && <span style={{ fontSize:11, color:'var(--mu)' }}>{athlete.level}</span>}
          {disabled && <span style={{ fontSize:10, color:'var(--ac)' }}>Assigned</span>}
        </button>
      })}</div>
    </div>)}
  </section>
}
