// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/exerciseMedia', () => ({ exerciseMedia: exercise => exercise.media }))
import ExerciseMedia from '../ExerciseMedia'
import { Dialog } from '../ui'

const exercise = { id: 'bridge', name: 'Bridge', media: { version_id: 'v1', width: 576, height: 540, videoUrl: '/demo.mp4', posterUrl: '/poster.webp' } }
let root, host, opener
const find = label => document.querySelector(`button[aria-label="${label}"]`)
async function click(node) { await act(async () => node.click()) }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus() }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  opener = document.createElement('button'); document.body.append(opener); opener.focus()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); opener.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('dialog and player recovery', () => {
  it('provides an explicit Close action and restores the connected opener on unmount', async () => {
    const close = vi.fn()
    await act(async () => root.render(<Dialog title="Exercise" onClose={close}><p>Details</p></Dialog>))
    expect(document.querySelector('dialog')?.open).toBe(true)
    await click(find('Close Exercise'))
    expect(close).toHaveBeenCalledOnce()
    await act(async () => root.render(null))
    expect(document.activeElement).toBe(opener)
  })
  it('restarts replay from zero and exposes Retry after a stalled load', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(<ExerciseMedia exercise={exercise} />))
    await click(find('Play Bridge demonstration'))
    const video = document.querySelector('video')
    video.currentTime = 7
    await click(find('Play Bridge demonstration'))
    expect(video.currentTime).toBe(0)
    expect(document.body.textContent).toContain('Replay demonstration')
    await act(async () => vi.advanceTimersByTime(15000))
    expect(document.body.textContent).toContain('taking too long')
    await click(find('Retry Bridge demonstration'))
    expect(document.querySelector('video')).toBeTruthy()
    expect(document.body.textContent).not.toContain('taking too long')
  })
  it('cancels only the enlarged player, leaving the parent dialog mounted', async () => {
    const closeParent = vi.fn()
    await act(async () => root.render(<Dialog title="Exercise" onClose={closeParent}><ExerciseMedia exercise={exercise} /></Dialog>))
    await click(find('Enlarge Bridge demonstration'))
    const enlarged = document.querySelector('dialog.exercise-media-dialog')
    await act(async () => enlarged.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })))
    expect(closeParent).not.toHaveBeenCalled()
    expect(document.querySelector('dialog.ui-dialog')?.open).toBe(true)
    expect(document.querySelector('dialog.exercise-media-dialog')).toBeNull()
  })
})
