import { MUSCLE_COLORS } from '../lib/theme'

// Read-only rendering of a workout's contents: title, muscle-group tag
// chips derived from its exercises, a prehab section if it has one, and
// the numbered main exercise list. Shared by the athlete portal's
// full-page preview and the coach-side floating preview panel — no
// checkboxes, timers, or completion state, this is purely "what's in here."
export default function WorkoutPreviewCard({ workout, exercises, prehabExercises }) {
  const groups = [...new Set(exercises.map(we => we.exercises?.muscle_group).filter(Boolean))]

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-head)', color: 'var(--tx)' }}>{workout.name}</h2>
        {groups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {groups.map(g => {
              const c = MUSCLE_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
              return (
                <span key={g} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.color }}>
                  {g}
                </span>
              )
            })}
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 8 }}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</p>
      </div>

      {prehabExercises.length > 0 && (
        <div style={{ background: 'rgba(199,228,92,.07)', border: '1px solid rgba(199,228,92,.28)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ac)', marginBottom: 8 }}>🛡 Prehab · {prehabExercises.length}</div>
          {prehabExercises.map(wp => (
            <div key={wp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, color: 'var(--tx)' }}>
              <span>{wp.exercises?.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{wp.sets}×{wp.reps || `${wp.duration_seconds}s`}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((we, i) => {
          const ex = we.exercises
          const c = MUSCLE_COLORS[ex?.muscle_group] || { bg: 'var(--br)', color: 'var(--mu)' }
          return (
            <div key={we.id} style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: 14, display: 'flex', gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--br)', color: 'var(--mu)', fontFamily: 'var(--mono)', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{ex?.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.color, flexShrink: 0 }}>{ex?.muscle_group}</span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ac)', margin: '4px 0' }}>
                  {we.sets} × {we.reps || `${we.duration_seconds}s`} · Rest {we.rest_seconds}s
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--mu)', lineHeight: 1.4 }}>{ex?.description}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
