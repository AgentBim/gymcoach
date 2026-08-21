import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const migrationDir = new URL('../supabase/migrations/', import.meta.url)

const recoveredMigrationHashes = {
  '20260508023917_create_gymcoach_schema.sql': 'd5ce0c1dc7475653df411b7469657ac0',
  '20260508024004_seed_exercise_library.sql': '02784245dc9ef1bdc719fcc20c803cec',
  '20260508052233_expand_exercises_arms_back.sql': '6b133eda750196af5adf3f5ec138078e',
  '20260508052337_expand_exercises_legs_core.sql': 'be86257122f1dc5b82e450d2166fb21a',
  '20260508052415_expand_exercises_shoulders.sql': 'dde35314d9650b0de8409cc727fa46e1',
  '20260508062009_create_workout_feedback.sql': '836133af04d926725d76b0e326175815',
  '20260508063748_fix_exercises_anon_read.sql': '8fcd2ed8377d0dccf5dfa9077360bae6',
  '20260508112812_create_athletes_and_assignments.sql': '3924ed451683bd8253ce437bcf009b03',
  '20260509205640_batch2_schema.sql': 'c705d39274a35db441aae3252596f6de',
  '20260511165641_add_exercise_category_prehab_focus.sql': '854a48bc3153d98b8536558002dfb661',
  '20260511165740_seed_prehab_exercises_shoulders_arms_back.sql': '74dbdeafbe8ac7bd79fbe64d3e873117',
  '20260511165821_seed_prehab_exercises_core_legs.sql': 'd7ad161ec56a6b85f213e0050c01a667',
  '20260513071047_add_is_ai_generated_to_workouts.sql': 'a396c6bee7effe15776a8c3a0a4d1aab',
}

describe('database migration contracts', () => {
  it('uses unique, ordered 14-digit migration versions', () => {
    const files = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort()
    const versions = files.map(name => name.slice(0, 14))
    expect(files).toHaveLength(20)
    expect(versions.every(version => /^\d{14}$/.test(version))).toBe(true)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('preserves the exact recovered production migration statements', () => {
    Object.entries(recoveredMigrationHashes).forEach(([name, expectedHash]) => {
      const sql = readFileSync(new URL(name, migrationDir), 'utf8')
        .replace(/\r/g, '')
        .replace(/[\r\n]+$/, '')
      expect(createHash('md5').update(sql).digest('hex'), name).toBe(expectedHash)
    })
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
