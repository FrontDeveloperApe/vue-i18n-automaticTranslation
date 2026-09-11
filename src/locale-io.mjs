/**
 * Locale JSON read/write with @i18n.* meta header.
 */

import fs from 'fs'
import path from 'path'
import { getContext } from './context.mjs'

export function isMetaKey(k) {
    return String(k).startsWith('@i18n.')
}

export function getLocaleCodes() {
    return getContext().localeCodes
}

export function getLocaleMeta() {
    return getContext().localeMeta
}

/** @deprecated use getLocaleCodes() — kept for call-site familiarity */
export const LOCALE_CODES = new Proxy([], {
    get(_t, prop) {
        if (prop === Symbol.iterator) {
            return function* () {
                yield* getLocaleCodes()
            }
        }
        if (prop === 'length') return getLocaleCodes().length
        if (prop === 'filter') return (...args) => getLocaleCodes().filter(...args)
        if (prop === 'includes') return (...args) => getLocaleCodes().includes(...args)
        if (typeof prop === 'string' && /^\d+$/.test(prop)) return getLocaleCodes()[Number(prop)]
        const codes = getLocaleCodes()
        const val = codes[prop]
        return typeof val === 'function' ? val.bind(codes) : val
    }
})

export const LOCALE_META = new Proxy(
    {},
    {
        get(_t, prop) {
            return getLocaleMeta()[prop]
        },
        ownKeys() {
            return Reflect.ownKeys(getLocaleMeta())
        },
        getOwnPropertyDescriptor(_t, prop) {
            const meta = getLocaleMeta()
            if (prop in meta) {
                return { configurable: true, enumerable: true, value: meta[prop] }
            }
            return undefined
        },
        has(_t, prop) {
            return prop in getLocaleMeta()
        }
    }
)

export function loadLocale(code) {
    const { localesDir } = getContext()
    const file = path.join(localesDir, `${code}.json`)
    if (!fs.existsSync(file)) return {}
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8') || '{}')
    } catch {
        return {}
    }
}

/** Save with @i18n.* meta fixed at the top */
export function saveLocale(code, data) {
    const { localesDir, localeMeta } = getContext()
    fs.mkdirSync(localesDir, { recursive: true })
    const meta = localeMeta[code]
    const rest = {}
    for (const [k, v] of Object.entries(data || {})) {
        if (!isMetaKey(k)) rest[k] = v
    }
    const sortedRest = Object.keys(rest)
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
        .reduce((acc, k) => {
            acc[k] = rest[k]
            return acc
        }, {})

    const out = meta
        ? {
              '@i18n.file': meta.file,
              '@i18n.code': meta.code,
              '@i18n.name': meta.name,
              '@i18n.nameZh': meta.nameZh,
              ...sortedRest
          }
        : sortedRest

    fs.writeFileSync(
        path.join(localesDir, `${code}.json`),
        JSON.stringify(out, null, 4) + '\n',
        'utf8'
    )
}
