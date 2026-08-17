import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationDir = new URL('../supabase/migrations/', import.meta.url)

describe('database migration contracts', () => {
  it('uses unique, ordered 14-digit migration versions', () => {
    const files = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort()
    const versions = files.map(name => name.slice(0, 14))
    expect(versions.every(version => /^\d{14}$/.test(version))).toBe(true)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('keeps public table access revoked and assignment feedback constrained', () => {
    const sql = readdirSync(migrationDir)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .map(name => readFileSync(new URL(name, migrationDir), 'utf8'))
      .join('\n')

    expect(sql).toMatch(/revoke all on table public\.coaches[\s\S]*public\.workouts/)
    expect(sql).toContain('workout_feedback_assignment_once_key')
    expect(sql).toContain('wa.assignment_token = p_share_token')
    expect(sql).toContain('and wa.revoked_at is null')
    expect(sql).toContain('and wa.expires_at > now()')
  })
})
