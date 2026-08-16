import { translations } from '../src/i18n/translations.ts'

export interface KeyInfo {
  path: string
  type: 'object' | 'string' | 'other'
  sampleValue?: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  totalNodes: number
  totalLeaves: number
  languages: readonly string[]
}

export function extractKeys(obj: unknown, prefix = ''): Map<string, KeyInfo> {
  const map = new Map<string, KeyInfo>()

  if (!obj || typeof obj !== 'object') {
    return map
  }

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      map.set(fullPath, { path: fullPath, type: 'object' })
      const nested = extractKeys(value, fullPath)
      for (const [nestedPath, info] of nested.entries()) {
        map.set(nestedPath, info)
      }
    } else if (typeof value === 'string') {
      map.set(fullPath, { path: fullPath, type: 'string', sampleValue: value })
    } else {
      map.set(fullPath, { path: fullPath, type: 'other', sampleValue: value })
    }
  }

  return map
}

export function validateTranslations(
  languages: readonly ('fr' | 'en' | 'ar')[] = ['fr', 'en', 'ar']
): ValidationResult {
  const langMaps = new Map<string, Map<string, KeyInfo>>()
  const allKeyPaths = new Set<string>()

  for (const lang of languages) {
    const langObj = (translations as Record<string, unknown>)[lang]
    if (!langObj) {
      return {
        valid: false,
        errors: [`Language '${lang}' is missing entirely from translations.ts`],
        totalNodes: 0,
        totalLeaves: 0,
        languages,
      }
    }
    const keyMap = extractKeys(langObj)
    langMaps.set(lang, keyMap)
    for (const key of keyMap.keys()) {
      allKeyPaths.add(key)
    }
  }

  const errors: string[] = []
  const sortedKeys = Array.from(allKeyPaths).sort()

  for (const key of sortedKeys) {
    const presence: Record<string, KeyInfo | undefined> = {}
    for (const lang of languages) {
      presence[lang] = langMaps.get(lang)?.get(key)
    }

    const missingIn = languages.filter((lang) => !presence[lang])
    if (missingIn.length > 0) {
      const presentIn = languages.filter((lang) => !!presence[lang])
      errors.push(
        `Missing key "${key}" in [${missingIn.join(', ')}] (present in [${presentIn.join(', ')}])`
      )
      continue
    }

    // Check type/nesting mismatch (e.g. object branch in fr, string leaf in en/ar)
    const types = languages.map((lang) => presence[lang]?.type)
    const allSameType = types.every((t) => t === types[0])
    if (!allSameType) {
      const typeBreakdown = languages.map((lang) => `${lang}: ${presence[lang]?.type}`).join(', ')
      errors.push(`Nesting/Type mismatch for key "${key}": { ${typeBreakdown} }`)
    }
  }

  const totalLeaves = Array.from(sortedKeys).filter(
    (key) => langMaps.get(languages[0])?.get(key)?.type === 'string'
  ).length

  return {
    valid: errors.length === 0,
    errors,
    totalNodes: sortedKeys.length,
    totalLeaves,
    languages,
  }
}

export function runCliCheck() {
  console.log('🔍 Deep-diffing translation keys and nesting structure across [fr, en, ar]...\n')
  const result = validateTranslations(['fr', 'en', 'ar'])

  if (!result.valid) {
    console.error(`❌ Build-time localization check failed with ${result.errors.length} mismatch(es):\n`)
    result.errors.forEach((err, i) => console.error(`  ${i + 1}. ${err}`))
    console.error(
      '\nBuild stopped: Ensure all translation keys and nesting structures match in src/i18n/translations.ts.\n'
    )
    process.exit(1)
  }

  console.log(
    `✅ Localization Check Passed: All ${result.totalNodes} translation keys (${result.totalLeaves} leaf strings) are 100% synchronized across [${result.languages.join(', ')}].\n`
  )
}

// Auto-run if executed directly
if (
  process.argv[1]?.includes('check-translations') ||
  import.meta.url === `file://${process.argv[1]}`
) {
  runCliCheck()
}
