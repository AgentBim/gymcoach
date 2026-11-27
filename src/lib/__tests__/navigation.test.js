import { describe, expect, it } from 'vitest'
import { coachReturnTo } from '../returnTo'
import { librarySearch } from '../libraryView'

describe('safe coach navigation', () => {
  it('retains internal destinations and rejects external or malformed redirects', () => {
    expect(coachReturnTo('/plan/exercises?q=bridge&exercise=123')).toBe('/plan/exercises?q=bridge&exercise=123')
    for (const target of ['//evil.example', 'https://evil.example', '/plan\\evil', '/athlete', '/login', null, '/today\n']) expect(coachReturnTo(target)).toBe('/today')
  })
  it('stores only supported library view fields and bounds free text', () => {
    expect(librarySearch('category=prehab&group=Back&q=cat&exercise=abc-123&token=secret')).toBe('category=prehab&group=Back&q=cat&exercise=abc-123')
    expect(librarySearch('category=invalid&group=invalid&exercise=https://evil')).toBe('')
    expect(new URLSearchParams(librarySearch('q=' + 'x'.repeat(500))).get('q')).toHaveLength(160)
  })
})
