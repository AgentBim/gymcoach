import { useState } from 'react'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed']
const GROUPS = ['Arms', 'Back', 'Legs', 'Core', 'Shoulders']

const FOCUS_COLORS = {
  activation: { bg: 'rgba(168,237,82,.12)',  color: '#A8ED52' },
  stability:  { bg: 'rgba(80,150,230,.12)',  color: '#6BB5F5' },
  mobility:   { bg: 'rgba(160,100,230,.12)', color: '#C084F5' },
  strength:   { bg: 'rgba(240,158,40,.12)',  color: '#F4B455' },
}

const GROUP_COLORS = {
  Arms:      { bg: 'rgba(240,158,40,.15)',  color: '#F4B455' },
  Back:      { bg: 'rgba(80,150,230,.15)',  color: '#6BB5F5' },
  Legs:      { bg: 'rgba(230,70,60,.15)',   color: '#F88080' },
  Core:      { bg: 'rgba(50,200,140,.15)',  color: '#5DD99A' },
  Shoulders: { bg: 'rgba(160,100,230,.15)', color: '#C084F5' },
}

const GROUP_EMOJI = {
  Arms: '💪', Back: '🔙', Legs: '🦵', Core: '🎯', Shoulders: '🔄',
}

if (!document.getElementById('ai-modal-styles')) {
  const s = document.createElement('style')
  s.id = 'ai-modal-styles'
  s.textContent = `
    @keyframes aiSlideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
    @keyframes aiSpin { to { transform:rotate(360deg) } }
    .ai-spin { animation:aiSpin 1s linear infinite; display:inline-block }
  `
  document.head.appendChild(s)
}

export default function AIGeneratorModal({ onClose, onResult, allExercises }) {
  const [prompt, setPrompt]               = useState('')
  const [difficulty, setDifficulty]       = useState('Mixed')
  const [includePrehab, setIncludePrehab] = useState(true)
  const [focusGroups, setFocusGroups]     = useState([])
  const [step, setStep]                   = useState('prompt')
  const [genSteps, setGenSteps]           = useState([
    { label: 'Analysing session description', status: 'todo' },
    { label: 'Searching exercise library',    status: 'todo' },
    { label: 'Selecting best exercises',      status: 'todo' },
    { label: 'Attaching prehab',              status: 'todo' },
    { label: 'Ready to review',               status: 'todo' },
  ])
  const [result, setResult] = useState(null)
  const [error, setError]   = useState('')

  const strengthCount = allExercises.filter(e => (e.category || 'strength') === 'strength').length
  const prehabCount   = allExercises.filter(e => e.category === 'prehab').length

  function toggleGroup(g) {
    setFocusGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }
  function removeExercise(idx) {
    setResult(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== idx) }))
  }
  function removePrehab(idx) {
    setResult(prev => ({ ...prev, prehab: prev.prehab.filter((_, i) => i !== idx) }))
  }
  function accept() {
    onResult({ name: result.name, exercises: result.exercises, prehab: result.prehab })
    onClose()
  }

  async function generate() {
    if (!prompt.trim()) { setError('Please describe the session first'); return }
    setError('')
    setStep('generating')

    ;[400, 900, 1600, 2400, 3200].forEach((d, i) => {
      setTimeout(() => {
        setGenSteps(prev => prev.map((s, idx) => ({
          ...s, status: idx < i ? 'done' : idx === i ? 'doing' : 'todo',
        })))
      }, d)
    })

    try {
      const se = allExercises.filter(e => (e.category || 'strength') === 'strength')
        .map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, difficulty: e.difficulty }))
      const pe = allExercises.filter(e => e.category === 'prehab')
        .map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, prehab_focus: e.prehab_focus }))

      const focusHint = focusGroups.length ? `Focus muscle groups: ${focusGroups.join(', ')}.` : ''

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a gymnastics S&C assistant. Return ONLY valid JSON, no markdown, no explanation.
Shape: {"workout_name":"string","reasoning":"string","exercises":[{"id":"uuid","sets":n,"reps":n|null,"duration_seconds":n|null,"rest_seconds":n}],"prehab":[same]}
Rules: 5–9 strength exercises. ${includePrehab ? '2–4 prehab matching muscle groups.' : 'Empty prehab array.'} Difficulty: ${difficulty}. ${focusHint} Only IDs from provided library.`,
          messages: [{ role: 'user', content: `Request: "${prompt}"\n\nStrength (${se.length}):\n${JSON.stringify(se)}\n\nPrehab (${pe.length}):\n${JSON.stringify(pe)}` }],
        }),
      })

      const data   = await res.json()
      const parsed = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim())
      const exMap  = Object.fromEntries(allExercises.map(e => [e.id, e]))

      const mapItems = (arr, fallbackRest) => (arr || [])
        .map(item => {
          const ex = exMap[item.id]
          return ex ? { exercise: ex, sets: item.sets, reps: item.reps || '', duration_seconds: item.duration_seconds || '', rest_seconds: item.rest_seconds || fallbackRest } : null
        })
        .filter(Boolean)

      setGenSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
      setTimeout(() => {
        setResult({ name: parsed.workout_name, reasoning: parsed.reasoning, exercises: mapItems(parsed.exercises, 30), prehab: mapItems(parsed.prehab, 20) })
        setStep('result')
      }, 400)

    } catch {
      setError('Something went wrong. Please try again.')
      setStep('prompt')
    }
  }

  // ── shared mini helpers ──
  const sLabel = (text, sub) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)' }}>
      {text}{sub && <span style={{ color: 'var(--mu)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> {sub}</span>}
    </div>
  )

  const chipBtn = (active, label, onClick, variant = 'default') => {
    const bg    = active ? (variant === 'purple' ? 'rgba(167,139,250,.18)' : variant === 'teal' ? 'rgba(48,232,200,.12)' : 'var(--ac)') : 'var(--br)'
    const color = active ? (variant === 'purple' ? '#A78BFA' : variant === 'teal' ? '#30E8C8' : '#0C1118') : 'var(--mu2)'
    const border = active ? (variant === 'purple' ? '1px solid rgba(167,139,250,.4)' : variant === 'teal' ? '1px solid rgba(48,232,200,.3)' : '1px solid transparent') : '1px solid transparent'
    return <button key={label} onClick={onClick} style={{ padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500, background: bg, color, border, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(9,13,20,.7)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'aiSlideUp .28s cubic-bezier(.32,1.2,.5,1)' }}>

        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--br2)', margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--br)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {step !== 'generating' && (
            <button onClick={step === 'result' ? () => { setStep('prompt'); setResult(null) } : onClose}
              style={{ background: 'var(--br)', border: 'none', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>←</button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-head,sans-serif)', letterSpacing: '-.01em' }}>
              {step === 'prompt' ? '✦ AI Workout Generator' : step === 'generating' ? 'Generating…' : `✦ ${result?.name || 'Generated Workout'}`}
            </div>
            {step === 'prompt' && <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 2 }}>Describe the session — AI builds from your library</div>}
            {step === 'result' && result && (
              <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, background: 'rgba(168,237,82,.12)', color: 'var(--ac)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{result.exercises.length} exercises</span>
                {result.prehab.length > 0 && <span style={{ fontSize: 10, background: 'rgba(48,232,200,.1)', color: '#30E8C8', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{result.prehab.length} prehab</span>}
                <span style={{ fontSize: 10, background: 'rgba(167,139,250,.1)', color: '#A78BFA', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>✦ AI</span>
              </div>
            )}
          </div>
        </div>

        {/* ══ PROMPT SCREEN ══ */}
        {step === 'prompt' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sLabel('Describe the session')}
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Upper body for Level 6 post-competition week, moderate intensity, shoulder stability focus, about 45 minutes…"
                  rows={4}
                  style={{ width: '100%', background: 'var(--s1)', border: '1.5px solid rgba(167,139,250,.35)', borderRadius: 12, color: 'var(--tx)', padding: '11px 13px', fontSize: 13, lineHeight: 1.6, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'right' }}>{prompt.length} / 300</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sLabel('Difficulty')}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DIFFICULTIES.map(d => chipBtn(difficulty === d, d, () => setDifficulty(d)))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sLabel('Focus muscle groups', '(optional)')}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {GROUPS.map(g => chipBtn(focusGroups.includes(g), g, () => toggleGroup(g), 'purple'))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sLabel('Prehab')}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {chipBtn(includePrehab,  '✓ Auto-attach prehab', () => setIncludePrehab(true),  'teal')}
                  {chipBtn(!includePrehab, 'Skip prehab',          () => setIncludePrehab(false))}
                </div>
              </div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 13px', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ac)', lineHeight: 1 }}>{strengthCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Strength</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#30E8C8', lineHeight: 1 }}>{prehabCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>Prehab</div>
                </div>
                <div style={{ flex: 1, fontSize: 11, color: 'var(--mu)', lineHeight: 1.5 }}>AI picks from your own library only</div>
              </div>

              {error && <div style={{ fontSize: 12, color: '#F88080', background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.2)', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
            </div>

            <div style={{ padding: '10px 16px 28px', borderTop: '1px solid var(--br)', flexShrink: 0 }}>
              <button onClick={generate} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#A78BFA,#7C5CFC)', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.01em', cursor: 'pointer', boxShadow: '0 6px 20px rgba(124,92,252,.35)' }}>
                ✦ &nbsp;Generate workout
              </button>
            </div>
          </>
        )}

        {/* ══ GENERATING SCREEN ══ */}
        {step === 'generating' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 24px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%,#A78BFA,#4F9EFF,rgba(48,232,200,.5))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 18, boxShadow: '0 0 40px rgba(167,139,250,.4)' }}>✦</div>
            <div style={{ fontFamily: 'var(--font-head,sans-serif)', fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>Building your workout</div>
            <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>Selecting from your library…</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
              {genSteps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--s1)', border: `1px solid ${s.status === 'done' ? 'rgba(168,237,82,.18)' : s.status === 'doing' ? 'rgba(167,139,250,.3)' : 'var(--br)'}`, borderRadius: 10, opacity: s.status === 'todo' ? 0.4 : 1, transition: 'all .3s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: s.status === 'done' ? 'rgba(168,237,82,.12)' : s.status === 'doing' ? 'rgba(167,139,250,.15)' : 'var(--br)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                    {s.status === 'done' ? '✓' : s.status === 'doing' ? <span className="ai-spin">⚙</span> : '·'}
                  </div>
                  <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                  {s.status === 'done' && <span style={{ color: 'var(--ac)', fontSize: 11 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ RESULT SCREEN ══ */}
        {step === 'result' && result && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={{ background: 'linear-gradient(135deg,rgba(167,139,250,.08),rgba(79,158,255,.05))', border: '1px solid rgba(167,139,250,.2)', borderRadius: 12, padding: '10px 13px', fontSize: 12, color: 'var(--mu2)', lineHeight: 1.6 }}>
                <span style={{ color: '#A78BFA', fontWeight: 700 }}>✦ AI reasoning: </span>{result.reasoning}
              </div>

              {result.prehab.length > 0 && (
                <div style={{ background: 'rgba(48,232,200,.05)', border: '1px solid rgba(48,232,200,.2)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 13px', background: 'rgba(48,232,200,.07)', borderBottom: '1px solid rgba(48,232,200,.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#30E8C8', textTransform: 'uppercase', letterSpacing: '.05em' }}>🛡 Prehab — {result.prehab.length} exercises</span>
                    <span style={{ fontSize: 10, color: 'rgba(48,232,200,.7)' }}>Do first</span>
                  </div>
                  {result.prehab.map((p, idx) => (
                    <div key={p.exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: idx < result.prehab.length - 1 ? '1px solid rgba(48,232,200,.08)' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(48,232,200,.4)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{p.exercise.name}</div>
                        {p.exercise.prehab_focus && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, fontWeight: 600, ...FOCUS_COLORS[p.exercise.prehab_focus] }}>{p.exercise.prehab_focus}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: '#30E8C8', flexShrink: 0 }}>{p.sets} × {p.reps || `${p.duration_seconds}s`}</span>
                      <button onClick={() => removePrehab(idx)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 15, cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  Main workout <span style={{ color: 'var(--ac)', fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{result.exercises.length} exercises</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {result.exercises.map((item, idx) => {
                    const gc = GROUP_COLORS[item.exercise.muscle_group] || { bg: 'var(--br)', color: 'var(--mu2)' }
                    return (
                      <div key={item.exercise.id} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'center' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 11, background: gc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                          {GROUP_EMOJI[item.exercise.muscle_group] || '🏋️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.exercise.name}</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {[`${item.sets} sets`, item.reps ? `${item.reps} reps` : `${item.duration_seconds}s`, `Rest ${item.rest_seconds}s`].map(c => (
                              <span key={c} style={{ background: 'var(--br)', borderRadius: 5, padding: '2px 6px', fontSize: 10, color: 'var(--mu2)', fontFamily: 'monospace' }}>{c}</span>
                            ))}
                            <span style={{ background: 'rgba(167,139,250,.1)', color: '#A78BFA', borderRadius: 5, padding: '2px 6px', fontSize: 10 }}>✦ AI</span>
                          </div>
                        </div>
                        <button onClick={() => removeExercise(idx)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 16, cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ padding: '10px 16px 28px', borderTop: '1px solid var(--br)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={accept} style={{ width: '100%', padding: '13px', background: 'var(--ac)', color: '#0C1118', borderRadius: 13, border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '-.01em' }}>
                Use this workout →
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('prompt'); setResult(null) }} style={{ flex: 1, padding: '10px', background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.25)', borderRadius: 12, fontSize: 12, fontWeight: 600, color: '#A78BFA', cursor: 'pointer' }}>
                  ✦ Regenerate
                </button>
                <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, fontSize: 12, fontWeight: 600, color: 'var(--mu2)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
