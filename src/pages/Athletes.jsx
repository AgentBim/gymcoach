import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRoster } from '../lib/useRoster'
import { Avatar, Button, Card, Chip, DotLegend, EmptyState, Icon, Label, Page, PageHeader, Pill, PillRow, SearchBox, UndoToast, WeekDots } from '../components/ui'
import AssignProgramDialog from '../components/AssignProgramDialog'
import AssignWorkoutDialog from '../components/AssignWorkoutDialog'
import ComposeDialog from '../components/ComposeDialog'

const COLS = '36px minmax(190px, 2fr) minmax(130px, 1.3fr) 76px 150px 100px 24px'

function chipFor(r) {
  if (r.reasons[0]) return { label: r.reasons[0].chip, tone: r.reasons[0].tone }
  if (r.noProgram) return { label: 'No program', tone: 'amber' }
  if (r.invitePending) return { label: 'Invite pending', tone: 'neutral' }
  return null
}

function Check({ on, label, onClick }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--ac)' : 'transparent', border: on ? '1px solid var(--ac)' : '1.5px solid var(--br2)', color: 'var(--ac-ink)' }}>
      {on && <Icon name="check" size={14} strokeWidth={3} />}
    </button>
  )
}

export default function Athletes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { loading, rows, programs, reload } = useRoster(user?.id)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // 'program' | 'workout'
  const [toast, setToast] = useState('')

  const groups = useMemo(() => [...new Set(rows.map(r => r.athlete.group_name).filter(Boolean))], [rows])
  const q = query.trim().toLowerCase()
  const match = r => {
    if (q && !r.athlete.full_name.toLowerCase().includes(q)) return false
    if (filter === 'attn') return r.needsAttention
    if (filter === 'noprog') return r.noProgram
    if (filter.startsWith('g:')) return r.athlete.group_name === filter.slice(2)
    return true
  }
  const countFor = f => rows.filter(r => (f === 'all' ? true : f === 'attn' ? r.needsAttention : f === 'noprog' ? r.noProgram : r.athlete.group_name === f.slice(2))).length
  const shown = rows.filter(match)
  const selected = rows.filter(r => sel.has(r.athlete.id))
  const allOn = shown.length > 0 && shown.every(r => sel.has(r.athlete.id))
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(allOn ? new Set() : new Set(shown.map(r => r.athlete.id)))
  const clear = () => setSel(new Set())

  const programCell = r => r.noProgram
    ? <span style={{ fontSize: 13, color: 'var(--mu)' }}>Not assigned</span>
    : <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{r.programName}</span>{r.weekLabel && <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--mu)', marginTop: 2 }}>{r.weekLabel}</span>}</span>
  const streakCell = r => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: r.streak > 0 ? 'var(--tx)' : 'var(--mu2)' }}>
      {r.streak > 2 && <Icon name="flame" size={16} style={{ color: 'var(--ac)' }} />}{r.streak}
    </span>
  )

  return (
    <Layout>
      <Page>
        <PageHeader eyebrow={`${rows.length} athlete${rows.length === 1 ? '' : 's'}`} title="Athletes">
          <SearchBox value={query} onChange={setQuery} placeholder="Search athletes" label="Search athletes" style={{ width: isMobile ? '100%' : 240 }} />
          <Button variant="primary" icon="plus" onClick={() => navigate('/athletes/new')}>Add athlete</Button>
        </PageHeader>

        <PillRow label="Filter athletes">
          <Pill on={filter === 'all'} count={countFor('all')} onClick={() => setFilter('all')}>All</Pill>
          <Pill on={filter === 'attn'} count={countFor('attn')} onClick={() => setFilter('attn')}>Needs attention</Pill>
          <Pill on={filter === 'noprog'} count={countFor('noprog')} onClick={() => setFilter('noprog')}>No program</Pill>
          {groups.map(g => <Pill key={g} on={filter === 'g:' + g} count={countFor('g:' + g)} onClick={() => setFilter('g:' + g)}>{g}</Pill>)}
        </PillRow>

        {loading ? <div style={{ color: 'var(--mu)', padding: 24 }}>Loading…</div> : (
          <Card style={{ overflow: 'hidden' }}>
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px', alignItems: 'center' }}>
                <Check on={allOn} label="Select all athletes" onClick={toggleAll} />
                <Label>Athlete</Label><Label>Program</Label><Label>Streak</Label>
                <span role="img" aria-label="This week, Monday to Sunday" style={{ display: 'inline-flex', gap: 6 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Label key={i} style={{ width: 14, textAlign: 'center' }}>{d}</Label>)}</span>
                <Label>Last trained</Label><span />
              </div>
            )}
            {shown.length === 0 && <EmptyState>{rows.length === 0 ? 'No athletes yet. Add your first one.' : 'No athletes match.'}</EmptyState>}
            {shown.map(r => {
              const a = r.athlete
              const on = sel.has(a.id)
              const chip = chipFor(r)
              const who = (
                <Link to={`/athletes/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={a.full_name} size={36} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a.full_name}</span>
                      {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--mu)', marginTop: 2 }}>{a.group_name || 'Ungrouped'}</span>
                  </span>
                </Link>
              )
              if (isMobile) {
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid var(--br)', background: on ? 'rgba(199,228,92,.06)' : 'transparent' }}>
                    <Check on={on} label={`Select ${a.full_name}`} onClick={() => toggle(a.id)} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {who}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--mu2)' }}>
                        <WeekDots days={r.week} size={12} gap={5} />{streakCell(r)}<span style={{ marginLeft: 'auto' }}>{r.lastLabel}</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--br)', background: on ? 'rgba(199,228,92,.06)' : 'transparent' }}>
                  <Check on={on} label={`Select ${a.full_name}`} onClick={() => toggle(a.id)} />
                  {who}
                  {programCell(r)}
                  {streakCell(r)}
                  <WeekDots days={r.week} size={14} gap={6} />
                  <span style={{ fontSize: 13, color: 'var(--mu2)' }}>{r.lastLabel}</span>
                  <Link to={`/athletes/${a.id}`} aria-label={`Open ${a.full_name}`} style={{ color: 'var(--mu)' }}><Icon name="forward" size={16} /></Link>
                </div>
              )
            })}
          </Card>
        )}

        <DotLegend items={['done', 'miss', 'today', 'rest', 'future']} />

        {selected.length > 0 && (
          <Card style={{ position: 'sticky', bottom: isMobile ? 76 : 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', boxShadow: '0 12px 32px rgba(0,0,0,.45)', zIndex: 30 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{selected.length} selected</span>
            {!isMobile && <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--mu2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.map(r => r.athlete.full_name).join(', ')}</span>}
            {isMobile && <span style={{ flex: 1 }} />}
            <Button variant="primary" size="sm" onClick={() => setDialog('program')}>Assign program</Button>
            <Button size="sm" onClick={() => setDialog('workout')}>Assign workout</Button>
            <Button size="sm" onClick={() => setDialog('message')}>Message</Button>
            <Button size="sm" onClick={clear}>Clear</Button>
          </Card>
        )}
      </Page>

      {dialog === 'program' && (
        <AssignProgramDialog athletes={selected.map(r => r.athlete)} programs={programs} coachId={user.id} onClose={() => setDialog(null)}
          onDone={msg => { setToast(msg); clear(); reload() }} />
      )}
      {dialog === 'workout' && (
        <AssignWorkoutDialog athletes={selected.map(r => r.athlete)} coachId={user.id} onClose={() => setDialog(null)}
          onDone={msg => { setToast(msg); clear(); reload() }} />
      )}
      {dialog === 'message' && (
        <ComposeDialog athletes={selected.map(r => r.athlete)} title={`Message ${selected.length} athlete${selected.length === 1 ? '' : 's'}`}
          why={`To ${selected.map(r => r.athlete.full_name).join(', ')}. Each person gets their own copy, not a group thread.`}
          templates={[['Weekly check-in', 'Hi, quick check-in from your coach. How is training feeling this week?'], ['Schedule change', 'Heads up: I adjusted your schedule. Open your portal to see what moved.'], ['Great week', 'Great work this week. Keep it rolling.']].map(([label, text]) => ({ label, text }))}
          initial="Hi, quick check-in from your coach. How is training feeling this week?"
          onClose={() => setDialog(null)} onSent={sent => { setToast(`Sent in-app to ${sent.length} athlete${sent.length === 1 ? '' : 's'}`); clear(); reload() }} />
      )}
      {toast && <UndoToast message={toast} onClose={() => setToast('')} />}
    </Layout>
  )
}
