import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCollectionLoad } from '../collectionLoad'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
afterEach(() => vi.useRealTimers())

describe('collection loading snapshots', () => {
  it('has no empty result before the first request succeeds', async () => {
    const snapshots = [], pending = deferred()
    const runner = createCollectionLoad(s => snapshots.push(s))
    const request = runner.run('coach', () => pending.promise)
    expect(snapshots.at(-1)).toMatchObject({ pending: true, hasData: false, data: null })
    pending.resolve([])
    expect(await request).toBe(true)
    expect(snapshots.at(-1)).toMatchObject({ pending: false, hasData: true, data: [] })
  })

  it('retains existing content throughout refreshes and refresh failures', async () => {
    const snapshots = [], runner = createCollectionLoad(s => snapshots.push(s))
    await runner.run('coach', async () => ['existing'])
    const refresh = deferred(), request = runner.run('coach', () => refresh.promise)
    expect(snapshots.at(-1)).toMatchObject({ pending: true, hasData: true, data: ['existing'] })
    refresh.reject(new Error('Offline'))
    expect(await request).toBe(false)
    expect(snapshots.at(-1)).toMatchObject({ pending: false, hasData: true, data: ['existing'], error: expect.any(Error) })
    expect(await runner.run('coach', async () => ['updated'])).toBe(true)
    expect(snapshots.at(-1)).toMatchObject({ data: ['updated'], error: null })
  })

  it('ignores an older result that arrives after a newer request', async () => {
    const snapshots = [], runner = createCollectionLoad(s => snapshots.push(s)), old = deferred()
    const first = runner.run('coach', () => old.promise)
    await Promise.resolve()
    await runner.run('coach', async () => ['new'])
    old.resolve(['old'])
    expect(await first).toBe(false)
    expect(snapshots.at(-1).data).toEqual(['new'])
  })

  it('clears the cached snapshot when switching coach identities', async () => {
    const snapshots = [], runner = createCollectionLoad(s => snapshots.push(s)), next = deferred()
    await runner.run('coach-a', async () => ['private-a'])
    const request = runner.run('coach-b', () => next.promise)
    expect(snapshots.at(-1)).toMatchObject({ key: 'coach-b', data: null, hasData: false })
    next.resolve(['private-b']); await request
    expect(snapshots.at(-1).data).toEqual(['private-b'])
  })

  it('stops skeleton loading on timeout, aborts the request and ignores late success', async () => {
    vi.useFakeTimers()
    const snapshots = [], runner = createCollectionLoad(s => snapshots.push(s), 100), pending = deferred()
    let signal
    const request = runner.run('coach', s => { signal = s; return pending.promise })
    await vi.advanceTimersByTimeAsync(100)
    expect(await request).toBe(false)
    expect(signal.aborted).toBe(true)
    expect(snapshots.at(-1)).toMatchObject({ pending: false, hasData: false, error: expect.any(Error) })
    pending.resolve(['too late']); await Promise.resolve()
    expect(snapshots.at(-1).hasData).toBe(false)
  })

  it('does not emit state updates after cancellation or unmount', async () => {
    const listener = vi.fn(), runner = createCollectionLoad(listener), pending = deferred()
    const request = runner.run('coach', () => pending.promise)
    runner.cancel()
    expect(await request).toBe(false)
    pending.resolve(['late']); await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
