import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

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
    const { data } = await supabase.from('athletes').select('*').eq('id', id).single()
    if (data) {
      setFullName(data.full_name)
      setGroup(data.group_name || '')
      setLevel(data.level || '')
      setNotes(data.notes || '')
    }
  }

  async function save() {
    if (!fullName.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const payload = { full_name: fullName.trim(), group_name: group.trim() || null, level: level || null, notes: notes.trim() || null, coach_id: user.id }
    if (isEdit) {
      await supabase.from('athletes').update(payload).eq('id', id)
    } else {
      await supabase.from('athletes').insert(payload)
    }
    navigate('/roster')
  }

  const inp = { background: 'var(--br)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: 'var(--tx)', padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'var(--font-sans)' }

  return (
    <Layout>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/roster')} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{isEdit ? 'Edit athlete' : 'Add athlete'}</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Full name *</div>
            <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Aaliyah Johnson" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Group</div>
              <input style={inp} value={group} onChange={e => setGroup(e.target.value)} placeholder="Group A" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Level</div>
              <select value={level} onChange={e => setLevel(e.target.value)} style={{ ...inp, appearance: 'none', WebkitAppearance: 'none' }}>
                <option value="">— select —</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 5 }}>Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Injury history, focus areas, goals..."
              style={{ ...inp, height: 80, resize: 'none', lineHeight: 1.5 }} />
          </div>

          {error && <p style={{ fontSize: 12, color: '#F88080' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={() => navigate('/roster')} style={{ flex: 1, background: 'transparent', border: '1px solid var(--br)', borderRadius: 10, color: 'var(--mu)', padding: 12, fontSize: 13, cursor: 'pointer', minHeight: 46 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, background: 'var(--ac)', color: '#0C1118', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minHeight: 46 }}>
              {saving ? 'Saving...' : isEdit ? 'Update athlete' : 'Add to roster'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
