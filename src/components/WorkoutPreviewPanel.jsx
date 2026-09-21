import { useState, useRef, useLayoutEffect, useEffect } from 'react'
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
export default function WorkoutPreviewPanel({ workoutId, anchorRect, onClose, onEdit }) {
  const panelRef = useRef(null)
  const [style, setStyle] = useState({ position: 'fixed', top: -9999, left: -9999, width: WIDTH, opacity: 0 })
  const { workout, exercises, prehabExercises, loading } = useWorkoutPreview(workoutId)

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
          <WorkoutPreviewCard workout={workout} exercises={exercises} prehabExercises={prehabExercises} />
        )}
      </div>

      {workout && (
        <div style={{ padding: 16 }}>
          <button onClick={onEdit}
            style={{ width: '100%', padding: 10, background: 'var(--ac)', color: 'var(--ac-ink)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✏️ Edit workout
          </button>
        </div>
      )}
    </div>
  )
}
