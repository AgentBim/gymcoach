import { describe, it, expect, vi } from 'vitest'
import { finishPendingAthleteInvite } from '../athleteInvite'

describe('pending invite recovery after athlete password authentication', () => {
  function setup(overrides = {}) {
    return { token: 'saved-invite', email: 'athlete@example.test', claim: vi.fn(async () => ({ error: null })), findAthlete: vi.fn(async () => ({ data: { id: 'athlete', user_id: 'signed-in-user' }, error: null })), clear: vi.fn(), ...overrides }
  }
  it('claims the saved invite before checking its resulting roster link', async () => {
    const order = []
    const args = setup({ claim: vi.fn(async (token, email) => { order.push('claim'); expect([token,email]).toEqual(['saved-invite','athlete@example.test']); return {error:null} }), findAthlete: vi.fn(async () => { order.push('lookup'); return {data:{id:'athlete'},error:null} }), clear: vi.fn(() => order.push('clear')) })
    expect(await finishPendingAthleteInvite(args)).toEqual({athlete:{id:'athlete'},error:null})
    expect(order).toEqual(['claim','lookup','clear'])
  })
  it('does not try to link an account without a saved invite', async () => {
    const args = setup({token:null})
    expect(await finishPendingAthleteInvite(args)).toEqual({athlete:null,error:null})
    expect(args.claim).not.toHaveBeenCalled(); expect(args.findAthlete).not.toHaveBeenCalled(); expect(args.clear).not.toHaveBeenCalled()
  })
  it('preserves a rejected invite and does not claim access', async () => {
    const error = {message:'Invite expired'}
    const args = setup({claim:vi.fn(async()=>({error}))})
    expect(await finishPendingAthleteInvite(args)).toEqual({athlete:null,error})
    expect(args.findAthlete).not.toHaveBeenCalled(); expect(args.clear).not.toHaveBeenCalled()
  })
  it('preserves the invite if the roster row is not visible after the claim', async () => {
    const args = setup({findAthlete:vi.fn(async()=>({data:null,error:null}))})
    expect(await finishPendingAthleteInvite(args)).toEqual({athlete:null,error:null})
    expect(args.clear).not.toHaveBeenCalled()
  })
  it('preserves the invite when the roster lookup fails', async () => {
    const error={message:'Network unavailable'}
    const args=setup({findAthlete:vi.fn(async()=>({data:null,error}))})
    expect(await finishPendingAthleteInvite(args)).toEqual({athlete:null,error})
    expect(args.clear).not.toHaveBeenCalled()
  })
})
