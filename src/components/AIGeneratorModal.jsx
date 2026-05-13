import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

// ── Styles ────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(9,13,20,.7)', backdropFilter: 'blur(6px)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  },
  sheet: {
    background: 'var(--bg)',
    borderRadius: '20px 20px 0 0',
    maxHeight: '96vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideUp .28s cubic-bezier(.32,1.2,.5,1)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: 'var(--br2)', margin: '10px auto 0',
  },
  header: {
    padding: '10px 16px 12px',
    borderBottom: '1px solid var(--br)',
    display: 'flex', alignItems: 'center', gap: 10,
    flexShrink: 0,
  },
  scrollBody: {
    flex: 1, overflowY: 'auto', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  section: {
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
    textTransform: 'uppercase', color: 'var(--mu)',
  },
  textarea: {
    width: '100%', background: 'var(--s1)',
    border: '1.5px solid rgba(167,139,250,.35)',
    borderRadius: 12, color: 'var(--tx)',
    padding: '11px 13px', fontSize: 13,
    fontFamily: 'var(--font-sans)', lineHeight: 1.6,
    outline: 'none', resize: 'none', minHeight: 80,
    boxSizing: 'border-box',
  },
  chip: (active, variant = 'default') => ({
    padding: '6px 13px', borderRadius: 20, fontSize: 12,
    fontWeight: active ? 700 : 500,
    background: active
      ? variant === 'purple' ? 'rgba(167,139,250,.18)'
        : variant === 'teal' ? 'rgba(48,232,200,.12)'
        : 'var(--ac)'
      : 'var(--br)',
    color: active
      ? variant === 'purple' ? '#A78BFA'
        : variant === 'teal' ? '#30E8C8'
        : '#0C1118'
      : 'var(--mu2)',
    border: active
      ? variant === 'purple' ? '1px solid rgba(167,139,250,.4)'
        : variant === 'teal'   ? '1px solid rgba(48,232,200,.3)'
        : '1px solid transparent'
      : '1px solid transparent',
    cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
  }),
  genBtn: (loading) => ({
    width: '100%', padding: '14px',
    background: loading ? 'rgba(167,139,250,.3)' : 'linear-gradient(135deg,#A78BFA 0%,#7C5CFC 100%)',
    borderRadius: 14, border: 'none',
    fontSize: 14, fontWeight: 800, color: '#fff',
    letterSpacing: '-.01em', cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: loading ? 'none' : '0 6px 20px rgba(124,92,252,.35)',
    transition: 'all .2s',
  }),
}

// CSS animation injected once
if (!document.getElementById('ai-modal-styles')) {
  const style = document.createElement('style')
  style.id = 'ai-modal-styles'
  style.textContent = `
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ai-spin { animation: spin 1s linear infinite; display: inline-block; }
  `
  document.head.appendChild(style)
}

export default function AIGeneratorModal({ onClose, onResult, allExercises }) {
  const [prompt, setPrompt] = useState('')
  const [difficulty, setDifficulty] = useState('Mixed')
  const [includePrehab, setIncludePrehab] = useState(true)
  const [focusGroups, setFocusGroups] = useState([])
  const [step, setStep] = useState('prompt') // 'prompt' | 'generating' | 'result'
  const [genSteps, setGenSteps] = useState([
    { label: 'Analysing session description', status: 'todo' },
    { label: 'Searching exercise library',    status: 'todo' },
    { label: 'Selecting best exercises',      status: 'todo' },
    { label: 'Attaching prehab',              status: 'todo' },
    { label: 'Ready to review',               status: 'todo' },
  ])
  const [result, setResult] = useState(null) // { name, exercises, prehab, reasoning }
  const [error, setError] = useState('')

  function toggleGroup(g) {
    setFocusGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  async function generate() {
    if (!prompt.trim()) { setError('Please describe the session first'); return }
    setError('')
    setStep('generating')

    // Animate gen steps
    const delays = [400, 900, 1600, 2400, 3200]
    delays.forEach((d, i) => {
      setTimeout(() => {
        setGenSteps(prev => prev.map((s, idx) => ({
          ...s,
          status: idx < i ? 'done' : idx === i ? 'doing' : 'todo',
        })))
      }, d)
    })

    try {
      // Build condensed exercise library for context
      const strengthExercises = allExercises
        .filter(e => (e.category || 'strength') === 'strength')
        .map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, difficulty: e.difficulty }))

      const prehabExercises = allExercises
        .filter(e => e.category === 'prehab')
        .map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, prehab_focus: e.prehab_focus }))

      const focusHint = focusGroups.length > 0
        ? `Focus muscle groups: ${focusGroups.join(', ')}.`
        : ''

      const systemPrompt = `You are a gymnastics strength and conditioning assistant. The coach will describe a training session. You must select exercises from the provided library and return ONLY valid JSON — no markdown, no explanation, just the JSON object.

Return this exact shape:
{
  "workout_name": "string (short descriptive name, max 5 words)",
  "reasoning": "string (1–2 sentences explaining your selection)",
  "exercises": [
    { "id": "uuid", "sets": number, "reps": number_or_null, "duration_seconds": number_or_null, "rest_seconds": number }
  ],
  "prehab": [
    { "id": "uuid", "sets": number, "reps": number_or_null, "duration_seconds": number_or_null, "rest_seconds": number }
  ]
}

Rules:
- Select 5–9 strength exercises. Match muscle groups and difficulty to the coach's description.
- ${includePrehab ? 'Select 2–4 prehab exercises that match the primary muscle groups being trained.' : 'Return an empty prehab array.'}
- Difficulty preference: ${difficulty}. ${focusHint}
- Only use IDs from the provided library. Do not invent exercises.
- Set reasonable sets (2–4), reps (6–20) or duration_seconds (20–60), and rest_seconds (20–90) per exercise.`

      const userMessage = `Coach's request: "${prompt}"

Strength exercise library (${strengthExercises.length} exercises):
${JSON.stringify(strengthExercises)}

Prehab exercise library (${prehabExercises.length} exercises):
${JSON.stringify(prehabExercises)}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      const data = await response.json()
      const raw = data.content?.[0]?.text || ''

      // Strip any accidental markdown fences
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Map IDs → full exercise objects
      const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))

      const exercises = (parsed.exercises || [])
        .map(item => {
          const ex = exMap[item.id]
          if (!ex) return null
          return { exercise: ex, sets: item.sets, reps: item.reps || '', duration_seconds: item.duration_seconds || '', rest_seconds: item.rest_seconds || 30 }
        })
        .filter(Boolean)

      const prehab = (parsed.prehab || [])
        .map(item => {
          const ex = exMap[item.id]
          if (!ex) return null
          return { exercise: ex, sets: item.sets, reps: item.reps || '', duration_seconds: item.duration_seconds || '', rest_seconds: item.rest_seconds || 20 }
        })
        .filter(Boolean)

      // Final step done
      setGenSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
      setTimeout(() => {
        setResult({ name: parsed.workout_name, reasoning: parsed.reasoning, exercises, prehab })
        setStep('result')
      }, 400)

    } catch (err) {
      setError('Something went wrong generating the workout. Try again.')
      setStep('prompt')
    }
  }

  function accept() {
    onResult({ name: result.name, exercises: result.exercises, prehab: result.prehab })
    onClose()
  }

  function removeExercise(idx) {
    setResult(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== idx) }))
  }

  function removePrehab(idx) {
    setResult(prev => ({ ...prev, prehab: prev.prehab.filter((_, i) => i !== idx) }))
  }

  // ── PROMPT SCREEN ─────────────────────────────────────────────
  function PromptScreen() {
    return (
      <>
        <div style={S.scrollBody}>
          <div style={S.section}>
            <div style={S.sectionLabel}>Describe the session</div>
            <textarea
              style={S.textarea}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Upper body for Level 6 post-competition week, moderate intensity, shoulder stability focus, about 45 minutes…"
              rows={4}
            />
            <div style={{ fontSize: 11, color: 'var(--mu)', textAlign: 'right' }}>{prompt.length} / 300</div>
          </div>

          <div style={S.section}>
            <div style={S.sectionLabel}>Difficulty</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={S.chip(difficulty === d)}>{d}</button>
              ))}
            </div>
          </div>

          <div style={S.section}>
            <div style={S.sectionLabel}>Focus muscle groups <span style={{ color: 'var(--mu)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {GROUPS.map(g => (
                <button key={g} onClick={() => toggleGroup(g)} style={S.chip(focusGroups.includes(g), 'purple')}>{g}</button>
              ))}
            </div>
          </div>

          <div style={S.section}>
            <div style={S.sectionLabel}>Prehab</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setIncludePrehab(true)}  style={S.chip(includePrehab, 'teal')}>✓ Auto-attach prehab</button>
              <button onClick={() => setIncludePrehab(false)} style={S.chip(!includePrehab)}>Skip prehab</button>
            </div>
          </div>

          <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 13px', display: 'flex', gap: 16 }}>
            {[
              { val: allExercises.filter(e => (e.category || 'strength') === 'strength').length, lbl: 'Strength exercises', col: 'var(--ac)' },
              { val: allExercises.filter(e => e.category === 'prehab').length, lbl: 'Prehab exercises', col: '#30E8C8' },
            ].map(({ val, lbl, col }) => (
              <div key={lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: col, fontFamily: 'var(--font-head, sans-serif)', lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>{lbl}</div>
              </div>
            ))}
            <div style={{ flex: 1, fontSize: 11, color: 'var(--mu)', lineHeight: 1.5, alignSelf: 'center' }}>
              AI picks from your own library only
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: '#F88080', background: 'rgba(255,82,82,.08)', border: '1px solid rgba(255,82,82,.2)', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}
        </div>

        <div style={{ padding: '10px 16px 28px', borderTop: '1px solid var(--br)', flexShrink: 0 }}>
          <button onClick={generate} style={S.genBtn(false)}>✦ &nbsp;Generate workout</button>
        </div>
      </>
    )
  }

  // ── GENERATING SCREEN ──────────────────────────────────────────
  function GeneratingScreen() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 24px', gap: 0 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #A78BFA, #4F9EFF, rgba(48,232,200,.5))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 18, boxShadow: '0 0 40px rgba(167,139,250,.4)' }}>✦</div>
        <div style={{ fontFamily: 'var(--font-head, sans-serif)', fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>Building your workout</div>
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
    )
  }

  // ── RESULT SCREEN ──────────────────────────────────────────────
  function ResultScreen() {
    return (
      <>
        <div style={S.scrollBody}>
          {/* AI reasoning pill */}
          <div style={{ background: 'linear-gradient(135deg,rgba(167,139,250,.08),rgba(79,158,255,.05))', border: '1px solid rgba(167,139,250,.2)', borderRadius: 12, padding: '10px 13px', fontSize: 12, color: 'var(--mu2)', lineHeight: 1.6 }}>
            <span style={{ color: '#A78BFA', fontWeight: 700 }}>✦ AI reasoning: </span>{result.reasoning}
          </div>

          {/* Prehab block */}
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
                      <span style={{ fontSize: 10, ...FOCUS_COLORS[p.exercise.prehab_focus], padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>{p.exercise.prehab_focus}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#30E8C8' }}>{p.sets} × {p.reps || `${p.duration_seconds}s`}</span>
                  <button onClick={() => removePrehab(idx)} style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 15, cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Main exercises */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              Main workout
              <span style={{ color: 'var(--ac)', fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{result.exercises.length} exercises</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {result.exercises.map((item, idx) => {
                const gc = GROUP_COLORS[item.exercise.muscle_group] || { bg: 'var(--br)', color: 'var(--mu2)' }
                return (
                  <div key={item.exercise.id} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: gc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      {item.exercise.muscle_group === 'Arms' ? '💪' : item.exercise.muscle_group === 'Back' ? '🔙' : item.exercise.muscle_group === 'Legs' ? '🦵' : item.exercise.muscle_group === 'Core' ? '🎯' : '🔄'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.exercise.name}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[`${item.sets} sets`, item.reps ? `${item.reps} reps` : `${item.duration_seconds}s`, `Rest ${item.rest_seconds}s`].map(chip => (
                          <span key={chip} style={{ background: 'var(--br)', borderRadius: 5, padding: '2px 6px', fontSize: 10, color: 'var(--mu2)', fontFamily: 'monospace' }}>{chip}</span>
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
    )
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.sheet}>
        <div style={S.handle} />
        <div style={S.header}>
          {step !== 'generating' && (
            <button onClick={step === 'result' ? () => { setStep('prompt'); setResult(null) } : onClose}
              style={{ background: 'var(--br)', border: 'none', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mu)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>
              ←
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-head, sans-serif)', letterSpacing: '-.01em' }}>
              {step === 'prompt' ? '✦ AI Workout Generator' : step === 'generating' ? 'Generating…' : `✦ ${result?.name || 'Generated Workout'}`}
            </div>
            {step === 'prompt' && <div style={{ fontSize: 11, color: 'var(--mu2)', marginTop: 2 }}>Describe the session — AI builds from your library</div>}
            {step === 'result' && (
              <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, background: 'rgba(168,237,82,.12)', color: 'var(--ac)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{result.exercises.length} exercises</span>
                {result.prehab.length > 0 && <span style={{ fontSize: 10, background: 'rgba(48,232,200,.1)', color: '#30E8C8', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{result.prehab.length} prehab</span>}
                <span style={{ fontSize: 10, background: 'rgba(167,139,250,.1)', color: '#A78BFA', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>✦ AI</span>
              </div>
            )}
          </div>
        </div>

        {step === 'prompt'     && <PromptScreen />}
        {step === 'generating' && <GeneratingScreen />}
        {step === 'result'     && <ResultScreen />}
      </div>
    </div>
  )
}
