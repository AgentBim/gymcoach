import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { MUSCLE_COLORS } from '../lib/theme'
import { DAYS, MUSCLE_GROUPS, FOCUS_PRESETS, CUSTOM_PRESET, typicalMix } from '../lib/programGenerator'

const PRESET_NAMES = [...Object.keys(FOCUS_PRESETS), CUSTOM_PRESET]

// What each training day leans toward (mockup screen "Day focus"). Shared by
// Fill a week and, later, the full-program flow.
//
// dayIdxs: the training days to show as tabs (0 = Mon).
// focus:   { [dayIdx]: { preset, weights } }, owned by the parent.
// onChange(nextFocus) replaces the whole map.
// count:   exercises per workout, for the "Typical workout" summary.
// initialMatchSame: whether "Apply to days with the same preset" starts on.
//   Only useful when days start with distinct presets (e.g. from a split);
//   when every day starts the same, it would make the first pick apply to all.
// initialDay: the tab to open on (defaults to the first training day).
export default function DayFocusEditor({ dayIdxs, focus, onChange, count, initialMatchSame = true, initialDay }) {
  const isMobile = useIsMobile()
  const [activeDay, setActiveDay] = useState(initialDay ?? dayIdxs[0] ?? 0)
  const [matchSame, setMatchSame] = useState(initialMatchSame)

  if (!dayIdxs.length) {
    return <p style={{ fontSize: 12, color: 'var(--mu)', margin: 0 }}>Pick at least one training day to set its focus.</p>
  }

  const active = dayIdxs.includes(activeDay) ? activeDay : dayIdxs[0]
  const current = focus[active]
  const total = MUSCLE_GROUPS.reduce((sum, g) => sum + current.weights[g], 0)
  const mix = typicalMix(current.weights, count)
  const sameCount = current.preset === CUSTOM_PRESET ? 0 : dayIdxs.filter(d => d !== active && focus[d].preset === current.preset).length
  const target = isMobile ? 44 : 34

  function pickPreset(name) {
    if (name === CUSTOM_PRESET) return
    const next = { ...focus }
    dayIdxs.forEach(d => {
      const synced = matchSame && current.preset !== CUSTOM_PRESET && focus[d].preset === current.preset
      if (d === active || synced) next[d] = { preset: name, weights: { ...FOCUS_PRESETS[name] } }
    })
    onChange(next)
  }

  function setWeight(group, value) {
    onChange({ ...focus, [active]: { preset: CUSTOM_PRESET, weights: { ...current.weights, [group]: value } } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div role="tablist" aria-label="Training days"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(dayIdxs.length, 4)}, minmax(0, 1fr))`, gap: 6 }}>
        {dayIdxs.map(d => {
          const on = d === active
          return (
            <button key={d} type="button" role="tab" aria-selected={on} aria-label={`${DAYS[d]}, ${focus[d].preset}`} onClick={() => setActiveDay(d)}
              style={{ minHeight: isMobile ? 52 : 44, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                background: on ? 'rgba(199,228,92,.12)' : 'var(--s2)', border: `1px solid ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}`, color: on ? 'var(--ac)' : 'var(--tx)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{DAYS[d]}</span>
              <span style={{ fontSize: 10.5, color: 'var(--mu)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{focus[d].preset}</span>
            </button>
          )
        })}
      </div>

      <div>
        <div style={{ fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Preset</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_NAMES.map(name => {
            const on = current.preset === name
            const isCustom = name === CUSTOM_PRESET
            return (
              <button key={name} type="button" aria-pressed={on} onClick={() => pickPreset(name)}
                disabled={isCustom && !on} title={isCustom ? 'Move a slider to customise' : undefined}
                style={{ minHeight: target, padding: '0 13px', borderRadius: target / 2, fontSize: 12.5, fontWeight: 600, cursor: isCustom ? 'default' : 'pointer',
                  background: on ? 'rgba(199,228,92,.14)' : 'transparent', color: on ? 'var(--ac)' : isCustom ? 'var(--mu)' : 'var(--tx)',
                  border: `1px ${isCustom && !on ? 'dashed' : 'solid'} ${on ? 'rgba(199,228,92,.45)' : 'var(--br)'}` }}>
                {name}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Body-part emphasis · {DAYS[active]}</div>
        {MUSCLE_GROUPS.map(g => {
          const c = MUSCLE_COLORS[g] || { bg: 'var(--br)', color: 'var(--mu)' }
          const pct = total ? Math.round((current.weights[g] / total) * 100) : Math.round(100 / MUSCLE_GROUPS.length)
          return (
            <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: target }}>
              <span style={{ width: 78, flexShrink: 0, fontSize: 10.5, fontWeight: 600, padding: '3px 0', borderRadius: 20, textAlign: 'center', background: c.bg, color: c.color }}>{g}</span>
              <input type="range" min={0} max={100} value={current.weights[g]} aria-label={`${g} emphasis for ${DAYS[active]}`}
                onChange={e => setWeight(g, parseInt(e.target.value, 10))}
                style={{ flex: 1, minWidth: 0, height: target, margin: 0, cursor: 'pointer', accentColor: 'var(--ac)' }} />
              <span style={{ width: 36, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{pct}%</span>
            </label>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--br)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>Typical workout</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mu)' }}>{count} EXERCISES</span>
        </div>
        <div aria-hidden="true" style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
          {mix.map(m => <span key={m.group} style={{ flexGrow: m.n, background: MUSCLE_COLORS[m.group]?.color }} />)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mix.map(m => {
            const c = MUSCLE_COLORS[m.group]
            return <span key={m.group} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.color }}>{m.group} ×{m.n}</span>
          })}
        </div>
        <span style={{ fontSize: 11, color: 'var(--mu)', lineHeight: 1.45 }}>Picks are random but weighted, so a low slider makes a group rare rather than removing it.</span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, minHeight: 44, borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--br)', cursor: 'pointer' }}>
        <input type="checkbox" checked={matchSame} onChange={e => setMatchSame(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ac)', flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>
            {sameCount > 0 ? `Apply to the other ${current.preset} day${sameCount > 1 ? 's' : ''}` : 'Apply to days with the same preset'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--mu)' }}>Picking a preset keeps days that shared the old one in sync</span>
        </span>
      </label>
    </div>
  )
}
