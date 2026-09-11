/**
 * Rewrite @i18n.* meta headers for all locale files.
 */

import { getLocaleCodes, loadLocale, saveLocale, getLocaleMeta } from './locale-io.mjs'

export function runInjectMeta() {
    for (const code of getLocaleCodes()) {
        const data = loadLocale(code)
        saveLocale(code, data)
        const m = getLocaleMeta()[code]
        console.log(`[ok] ${m.file} → ${m.name} / ${m.nameZh}`)
    }
    console.log('[i18n:inject-meta] done')
}
