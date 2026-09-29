import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useWorkoutPreview } from '../lib/useWorkoutPreview'
import WorkoutPreviewCard from './WorkoutPreviewCard'

const MARGIN = 8
const WIDTH = 340

// A "card popped up near what I clicked" peek at a workout, not a modal —
// no backdrop, whatever was open behind it (the week grid, the day-editor
// drawer) stays live. Anchors to the trigger element's on-screen position,
// picking a side/edge that keeps the panel fully on screen even for a long
// exercise list, and closes on an outside click without touching whatever
// state was behind it.
//
// draftWorkout ({ name, exercises, prehab }) previews an unsaved program
// workout with no fetch. Drafts have nothing to edit yet, so the Edit button
// stays hidden for them.
//
// A saved program-generated workout also gets "Save to library": a regular,
// hand-built copy under the same name (duplicate_workout with p_name), for
// reusing it outside its program. onSavedToLibrary(newId) lets the page
// refresh its lists.
export default function WorkoutPreviewPanel({ workoutId, draftWorkout = null, anchorRect, onClose, onEdit, onSavedToLibrary }) {
  const panelRef = useRef(null)
  const [style, setStyle] = useState({ position: 'fixed', top: -9999, left: -9999, width: WIDTH, opacity: 0 })
  const { workout, exercises, prehabExercises, loading } = useWorkoutPreview(workoutId, draftWorkout)
  const [libraryState, setLibraryState] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [libraryError, setLibraryError] = useState('')

  async function saveToLibrary() {
    setLibraryState('saving')
    setLibraryError('')
    const { data, error } = await supabase.rpc('duplicate_workout', { p_workout_id: workout.id, p_name: workout.name })
    if (error) {
      setLibraryState('idle')
      setLibraryError(error.message || 'Could not save to your library')
      return
    }
    setLibraryState('saved')
    onSavedToLibrary?.(data)
  }

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return

    const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2)
    const maxHeight = window.innerHeight - MARGIN * 2
    const height = Math.min(el.offsetHeight, maxHeight)

    const onRightHalf = anchorRect.left > window.innerWidth / 2
    let left = onRightHalf ? anchorRect.right - width : anchorRect.left
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))

    const spaceBelow = window.innerHeight - anchorRect.bottom - MARGIN
    const fitsBelow = spaceBelow >= height
    const top = fitsBelow
      ? anchorRect.bottom + MARGIN
      : Math.max(MARGIN, anchorRect.top - MARGIN - height)

    setStyle({ position: 'fixed', top, left, width, maxHeight, opacity: 1 })
  }, [anchorRect, loading])

  useEffect(() => {
    function handleOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  return (
    <div ref={panelRef} style={{
      ...style,
      background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14,
      boxShadow: '0 12px 32px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column',
      zIndex: 1000, transition: 'opacity .1s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0' }}>
        <button onClick={onClose} aria-label="Close"
          style={{ background: 'none', border: 'none', color: 'var(--mu)', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
          ×
        </button>
      </div>

      <div style={{ padding: '0 16px', overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ color: 'var(--mu)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        ) : !workout ? (
          <div style={{ color: 'var(--mu)', textAlign: 'center', padding: '20px 0' }}>Workout not found</div>
        ) : (
          <>
            {draftWorkout && (
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 10 }}>Generated draft · created when you save the program</div>
            )}
            <WorkoutPreviewCard workout={workout} exercises={exercises} prehabExercises={prehabExercises} />
          </>
        )}
      </div>

      {workout && !draftWorkout && (onEdit || workout.program_generated) && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workout.program_generated && (
            <>
              <button onClick={saveToLibrary} disabled={libraryState !== 'idle'}
                style={{ width: '100%', minHeight: 40, padding: 10, background: 'var(--s2)', color: libraryState === 'saved' ? 'var(--ac)' : 'var(--tx)', border: '1px solid var(--br)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: libraryState === 'idle' ? 'pointer' : 'default' }}>
                {libraryState === 'saved' ? '✓ Saved to your library' : libraryState === 'saving' ? 'Saving…' : '📥 Save to library'}
              </button>
              <span style={{ fontSize: 11, color: libraryError ? '#E2695A' : 'var(--mu)', lineHeight: 1.4 }}>
                {libraryError || (libraryState === 'saved'
                  ? 'A regular copy is now in your workouts. This one stays with its program.'
                  : 'Program workouts live inside their program. This makes a regular copy you can reuse anywhere.')}
              </span>
            </>
          )}
          {onEdit && (
            <button onClick={onEdit}
              style={{ width: '100%', padding: 10, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Edit workout
            </button>
          )}
        </div>
      )}
    </div>
  )
}
