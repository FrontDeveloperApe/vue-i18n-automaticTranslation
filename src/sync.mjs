/**
 * Sync missing keys from sourceLocale to other locale packs (Chinese placeholder by default).
 */

import { getLocaleCodes, loadLocale, saveLocale, isMetaKey } from './locale-io.mjs'
import { getContext } from './context.mjs'

export function runSync(argv = []) {
    const fillEmpty = argv.includes('--fill=empty')
    const { sourceLocale } = getContext()
    const zh = loadLocale(sourceLocale)
    let total = 0

    for (const code of getLocaleCodes()) {
        if (code === sourceLocale) continue
        const pack = loadLocale(code)
        let added = 0
        for (const [key, value] of Object.entries(zh)) {
            if (isMetaKey(key)) continue
            if (!(key in pack) || pack[key] == null || pack[key] === '') {
                pack[key] = fillEmpty ? '' : value
                added++
            }
        }
        saveLocale(code, pack)
        total += added
        console.log(`[i18n:sync] ${code}: +${added}`)
    }

    console.log(`[i18n:sync] done, synced ${total} missing keys`)
    return total
}
