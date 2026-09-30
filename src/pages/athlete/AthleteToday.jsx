import { useState, useEffect } from 'react'
import { useAthleteAuth } from '../../hooks/useAthleteAuth'
import { useAthleteStreak } from '../../hooks/useAthleteStreak'
import { supabase } from '../../lib/supabase'
import { WorkoutRunner } from '../../components/WorkoutRunner'
import { todayLocal, resolveProgramCell } from '../../lib/streaks'
import { DAY_TYPE_COLORS } from '../../lib/theme'

// What the athlete's program has scheduled for today — shown on every
// variant of this page (rest, logged, workout) so the coach's day type and
// notes are visible even when nothing is due.
function ProgramDayCard({ programDay, optional }) {
  if (!programDay) return null
  const { program, week, cell } = programDay
  const meta = DAY_TYPE_COLORS[cell?.day_type || 'rest'] || DAY_TYPE_COLORS.rest
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: meta.bg, color: meta.color, flexShrink: 0 }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {program.name} · Week {week} of {program.duration_weeks}
        </span>
      </div>
      {cell?.workouts?.name && (
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>
          {cell.workouts.name}
          {optional && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--mu2)', marginLeft: 8 }}>Optional</span>}
        </div>
      )}
      {cell?.notes && <div style={{ fontSize: 12, color: 'var(--mu2)', marginTop: 2 }}>{cell.notes}</div>}
      {!cell?.workouts?.name && !cell?.notes && <div style={{ fontSize: 12, color: 'var(--mu)' }}>Nothing else scheduled for today.</div>}
    </div>
  )
}

export default function AthleteToday() {
  const { athlete } = useAthleteAuth()
  const { streak, loading: streakLoading, todayDue, todayWorkoutId, todayOptional, todayLogged, refresh } = useAthleteStreak(athlete?.id)

  const [assignedWorkouts, setAssignedWorkouts] = useState([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [prehabExercises, setPrehabExercises] = useState([])
  const [loadingWorkout, setLoadingWorkout] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [programDay, setProgramDay] = useState(null)
  // Recovery/competition days can carry an optional workout; it only opens
  // once the athlete chooses to do it.
  const [optionalStarted, setOptionalStarted] = useState(false)

  const effectiveWorkoutId = todayWorkoutId || selectedWorkoutId

  // Off-program (or on-program-but-no-specific-workout) days let the athlete
  // pick from whatever's been assigned to them directly.
  useEffect(() => {
    if (streakLoading || todayWorkoutId || todayLogged) return
    fetchAssignedWorkouts()
  }, [streakLoading, todayWorkoutId, todayLogged, athlete?.id])

  useEffect(() => { fetchProgramDay() }, [athlete?.id, athlete?.active_program_id, athlete?.program_started_on])

  async function fetchProgramDay() {
    const today = todayLocal()
    if (!athlete?.active_program_id || !athlete.program_started_on || today < athlete.program_started_on) {
      setProgramDay(null)
      return
    }
    const { data: program } = await supabase.from('programs').select('id, name, duration_weeks').eq('id', athlete.active_program_id).single()
    if (!program) { setProgramDay(null); return }
    const { week_number, day_of_week } = resolveProgramCell(athlete.program_started_on, program.duration_weeks, today)
    const { data: cell } = await supabase.from('program_days')
      .select('day_type, notes, workout_id, workouts(id, name)')
      .eq('program_id', program.id).eq('week_number', week_number).eq('day_of_week', day_of_week)
      .maybeSingle()
    setProgramDay({ program, week: week_number, cell })
  }

  async function fetchAssignedWorkouts() {
    if (!athlete) return
    const { data } = await supabase
      .from('workout_assignments')
      .select('workout_id, workouts(id, name)')
      .eq('athlete_id', athlete.id)
    setAssignedWorkouts((data || []).map(a => a.workouts).filter(Boolean))
  }

  useEffect(() => {
    if (!effectiveWorkoutId) { setWorkout(null); return }
    fetchWorkout(effectiveWorkoutId)
  }, [effectiveWorkoutId])

  async function fetchWorkout(id) {
    setLoadingWorkout(true)
    const { data: w } = await supabase.from('workouts').select('*').eq('id', id).single()
    const { data: ex } = await supabase.from('workout_exercises').select('*, exercises(*)').eq('workout_id', id).order('position')
    const { data: pre } = await supabase.from('workout_prehab').select('*, exercises(*)').eq('workout_id', id).order('position')
    setWorkout(w)
    setExercises(ex || [])
    setPrehabExercises(pre || [])
    setLoadingWorkout(false)
  }

  async function submitFeedback(payload) {
    const { error } = await supabase.rpc('submit_athlete_workout_feedback', {
      p_workout_id: effectiveWorkoutId,
      p_emoji_rating: payload.emoji_rating,
      p_rpe: payload.rpe,
      p_notes: payload.notes,
      p_exercises_completed: payload.exercises_completed,
      p_completed_date: todayLocal(),
    })
    if (error) throw error
  }

  if (streakLoading) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading...</div>

  if (!todayDue && !(todayOptional && optionalStarted && !todayLogged && !justCompleted)) {
    const meta = DAY_TYPE_COLORS[programDay?.cell?.day_type || 'rest'] || DAY_TYPE_COLORS.rest
    return (
      <div>
        <ProgramDayCard programDay={programDay} optional={todayOptional} />
        <div style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>{(todayLogged || justCompleted) ? '✅' : meta.icon}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>{meta.label} day</div>
          {todayLogged || justCompleted ? (
            <p style={{ fontSize: 13, color: 'var(--mu)' }}>Optional workout logged — that's +1 on your streak.</p>
          ) : todayOptional ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16 }}>Today's workout is optional — doing it adds to your streak, skipping it won't break it.</p>
              <button onClick={() => setOptionalStarted(true)}
                style={{ padding: '11px 20px', background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Start optional workout
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--mu)' }}>No workout to log today — your streak is safe. Back tomorrow.</p>
          )}
        </div>
      </div>
    )
  }

  if (todayLogged || justCompleted) {
    return (
      <div>
        <ProgramDayCard programDay={programDay} />
        <div style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}>Already logged today</div>
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Nice work — see you tomorrow.</p>
        </div>
      </div>
    )
  }

  if (!todayWorkoutId && !selectedWorkoutId) {
    return (
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 4 }}>What are you logging today?</div>
        <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 16 }}>You're not on a set program, so any completed workout keeps your streak going.</p>
        {assignedWorkouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--mu)', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12 }}>
            No workouts assigned yet — ask your coach.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignedWorkouts.map(w => (
              <button key={w.id} onClick={() => setSelectedWorkoutId(w.id)}
                style={{ textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--br)', borderRadius: 12, padding: '14px 16px', color: 'var(--tx)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {w.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loadingWorkout || !workout) return <div style={{ color: 'var(--mu)', textAlign: 'center', padding: 40 }}>Loading workout...</div>

  return (
    <div>
      {todayWorkoutId && <ProgramDayCard programDay={programDay} optional={todayOptional} />}
      <WorkoutRunner
        workout={workout}
        exercises={exercises}
        prehabExercises={prehabExercises}
        onSubmitFeedback={submitFeedback}
        onFeedbackSubmitted={() => { setJustCompleted(true); refresh() }}
      />
    </div>
  )
}
