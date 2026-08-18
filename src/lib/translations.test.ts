import { describe, it, expect } from 'vitest'
import { validateTranslations } from '../../scripts/check-translations'

describe('i18n translations validation', () => {
  it('should have 100% matched keys and types across all supported languages (fr, en, ar)', () => {
    const result = validateTranslations(['fr', 'en', 'ar'])
    if (!result.valid) {
      console.error('Translation validation mismatches:', result.errors)
    }
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
    expect(result.totalNodes).toBeGreaterThan(100)
    expect(result.totalLeaves).toBeGreaterThan(100)
  })
})
