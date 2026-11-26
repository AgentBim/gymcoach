import { useEffect, useRef, useState } from 'react'
import { exerciseMedia } from '../lib/exerciseMedia'
import './ExerciseMedia.css'

let activeVideo = null
function claimPlayback(video) {
  if (activeVideo && activeVideo !== video) activeVideo.pause()
  activeVideo = video
}

export default function ExerciseMedia({ exercise, compact = false, disabled = false }) {
  const media = exerciseMedia(exercise)
  if (!media) return null
  return <MediaPlayer key={`${exercise.id}:${media.version_id}`} name={exercise.name} media={media} compact={compact} disabled={disabled} />
}

function MediaPlayer({ name, media, compact, disabled }) {
  const [open, setOpen] = useState(!compact)
  const [loaded, setLoaded] = useState(false)
  const [request, setRequest] = useState(0)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const videoRef = useRef(null)
  const boxRef = useRef(null)
  const dialogRef = useRef(null)
  const expandButton = useRef(null)
  const lastRequest = useRef(0)
  const wasExpanded = useRef(false)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { setReducedMotion(preference.matches); videoRef.current?.pause() }
    preference.addEventListener('change', change)
    return () => preference.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const onHidden = () => { if (document.hidden) videoRef.current?.pause() }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [])

  useEffect(() => {
    if (disabled || !open) videoRef.current?.pause()
  }, [disabled, open])

  useEffect(() => {
    if (!open || !boxRef.current) return
    const observer = new IntersectionObserver(items => {
      if (!items[0].isIntersecting) videoRef.current?.pause()
    })
    observer.observe(boxRef.current)
    return () => observer.disconnect()
  }, [open, expanded])

  useEffect(() => {
    if (expanded) dialogRef.current?.showModal()
    else if (wasExpanded.current) expandButton.current?.focus()
    wasExpanded.current = expanded
    return () => { videoRef.current?.pause() }
  }, [expanded])

  useEffect(() => {
    if (!loaded || disabled || !videoRef.current || request === lastRequest.current) return
    lastRequest.current = request
    const video = videoRef.current
    claimPlayback(video)
    let current = true
    video.play().catch(error => {
      // Switching players or leaving the screen can abort a pending play().
      if (current) {
        setWaiting(false)
        if (error.name !== 'AbortError') setError('Playback could not start. Try again.')
      }
    })
    return () => { current = false }
  }, [loaded, request, disabled])

  useEffect(() => {
    const video = videoRef.current
    return () => { video?.pause(); if (activeVideo === video) activeVideo = null }
  }, [loaded, expanded, error, open])

  function play() {
    setError('')
    setWaiting(true)
    setLoaded(true)
    setRequest(n => n + 1)
  }
  function closeDialog() {
    videoRef.current?.pause()
    dialogRef.current?.close()
    setExpanded(false)
    expandButton.current?.focus()
  }
  const notes = [...new Set([media.demonstration_note, media.exercise_note].filter(n => typeof n === 'string' && n.trim()))]
  const body = <div ref={boxRef}>
    <div className="exercise-media-frame" style={{ aspectRatio: `${media.width}/${media.height}` }}>
      {loaded && !error ? <video ref={videoRef} data-exercise-media aria-label={`${name} demonstration`}
        src={media.videoUrl} poster={posterFailed ? undefined : media.posterUrl} controls playsInline muted
        onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)} onPause={() => setWaiting(false)}
        loop={!reducedMotion} preload="none" onPlay={e => { if (disabled) e.currentTarget.pause(); else claimPlayback(e.currentTarget) }}
        onError={() => { videoRef.current?.pause(); setWaiting(false); setError('The demonstration could not load. Your exercise instructions are still available.') }} />
        : !posterFailed ? <img src={media.posterUrl} width={media.width} height={media.height} loading="lazy"
          alt={`${name} demonstration poster`} onError={() => setPosterFailed(true)} />
          : <p>Demonstration preview unavailable</p>}
    </div>
    <div className="exercise-media-actions">
      <button type="button" disabled={disabled} onClick={play} aria-label={`${error ? 'Retry' : 'Play'} ${name} demonstration`}>
        {error ? 'Retry demonstration' : loaded ? 'Play again' : 'Play demonstration'}
      </button>
      {!expanded && <button ref={expandButton} type="button" onClick={() => { videoRef.current?.pause(); setExpanded(true) }} aria-label={`Enlarge ${name} demonstration`}>Enlarge</button>}
    </div>
    {error && <p className="exercise-media-note" role="status">{error}</p>}
    {waiting && !error && <p className="exercise-media-note" role="status">Loading demonstration…</p>}
    {reducedMotion && <p className="exercise-media-note">Reduced motion: plays once when requested.</p>}
    {notes.map(note => <p className="exercise-media-note" key={note}>{note}</p>)}
  </div>

  return <div className="exercise-media" onClick={e => e.stopPropagation()}>
    {compact && <button type="button" className="exercise-media-toggle" disabled={disabled} aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'View'} ${name} demonstration`} onClick={() => { videoRef.current?.pause(); setOpen(!open) }}>
      {open ? 'Hide demonstration' : 'View demonstration'}
    </button>}
    {open && !expanded && body}
    {expanded && <dialog className="exercise-media-dialog" ref={dialogRef} aria-label={`${name} demonstration enlarged`}
      onCancel={e => { e.preventDefault(); closeDialog() }} onClick={e => { if (e.target === e.currentTarget) closeDialog() }}>
      <header><strong>{name}</strong><button type="button" onClick={closeDialog}>Close demonstration</button></header>
      {body}
    </dialog>}
  </div>
}
