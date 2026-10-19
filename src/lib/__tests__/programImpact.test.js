import { describe, it, expect } from 'vitest'
import { impactForWeek, athleteWeek } from '../programImpact'

// Fri 2026-10-16; Maya and Tess started Oct 5 (week 2), Noor starts Oct 19.
const TODAY = '2026-10-16'
const maya = { id: 'm', full_name: 'Maya R.', program_started_on: '2026-10-05' }
const tess = { id: 't', full_name: 'Tess O.', program_started_on: '2026-10-05' }
const noor = { id: 'n', full_name: 'Noor B.', program_started_on: '2026-10-19' }

describe('athleteWeek', () => {
  it('resolves the current program week or a future start', () => {
    expect(athleteWeek(maya, 4, TODAY)).toEqual({ week: 2 })
    expect(athleteWeek(noor, 4, TODAY)).toEqual({ startsOn: '2026-10-19' })
  })
})

describe('impactForWeek', () => {
  it('names athletes in the edited week and who starts later', () => {
    const r = impactForWeek({ athletes: [maya, tess, noor], week: 2, weeks: 4, today: TODAY })
    expect(r).toMatchObject({ head: '2 athletes affected', live: true, tone: 'amber', affected: ['m', 't'] })
    expect(r.text).toBe('Maya R. and Tess O. are in week 2 now. Noor B. starts on Mon, Oct 19.')
  })

  it('says a later week applies when athletes reach it', () => {
    const r = impactForWeek({ athletes: [maya, tess], week: 3, weeks: 4, today: TODAY })
    expect(r.head).toBe('Applies later')
    expect(r.text).toBe('Athletes reach week 3 on Mon, Oct 19. Nobody sees this yet.')
    expect(r.live).toBe(false)
  })

  it('treats an already-finished week as coming round again', () => {
    const r = impactForWeek({ athletes: [maya], week: 1, weeks: 4, today: TODAY })
    expect(r.head).toBe('Applies later')
    expect(r.text).toContain('Mon, Nov 2')
  })

  it('handles a program nobody is on', () => {
    expect(impactForWeek({ athletes: [], week: 1, weeks: 4, today: TODAY }).head).toBe('No athletes yet')
  })
})
