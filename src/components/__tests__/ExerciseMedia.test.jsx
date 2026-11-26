import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExerciseMedia from '../ExerciseMedia'

vi.mock('../../lib/exerciseMedia', () => ({ exerciseMedia: exercise => exercise?.media || null }))
const exercise = { id: 'exercise-id', name: 'Squat', media: {
  version_id: 'v1', width: 576, height: 540, videoUrl: '/demo.mp4', posterUrl: '/poster.webp',
  demonstration_note: 'Repeat on each side.', exercise_note: 'Repeat on each side.',
} }
beforeEach(() => vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) }))
afterEach(() => vi.unstubAllGlobals())

describe('exercise media initial network boundary', () => {
  it('renders only the poster before Play, never a video or MP4 source', () => {
    const html = renderToStaticMarkup(<ExerciseMedia exercise={exercise} />)
    expect(html).toContain('/poster.webp')
    expect(html).toContain('Play Squat demonstration')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('/demo.mp4')
    expect(html.match(/Repeat on each side\./g)).toHaveLength(1)
  })
  it('keeps compact demonstrations closed with no poster or video request', () => {
    const html = renderToStaticMarkup(<ExerciseMedia exercise={exercise} compact />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('/demo.mp4')
  })
  it('leaves missing media empty and exposes a disabled Play control when locked', () => {
    expect(renderToStaticMarkup(<ExerciseMedia exercise={{ id: 'no-media' }} />)).toBe('')
    const html = renderToStaticMarkup(<ExerciseMedia exercise={exercise} disabled />)
    expect(html).toMatch(/disabled=""[^>]*aria-label="Play Squat demonstration"/)
    expect(html).not.toContain('<video')
  })
})
