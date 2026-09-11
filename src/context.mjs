/**
 * Shared runtime context for all i18n modules.
 * Set once by CLI after loading vite.config i18nAuto.
 */

import path from 'path'
import { DEFAULT_LOCALE_META } from './defaults.mjs'

/** @type {null | import('./config.mjs').I18nRuntimeContext} */
let ctx = null

export function setContext(next) {
    ctx = next
}

export function getContext() {
    if (!ctx) {
        throw new Error(
            '[i18n-auto] context not initialized. Run via `i18n-auto` CLI or call setContext() first.'
        )
    }
    return ctx
}

export function buildLocaleMeta(targetLocales, sourceLocale) {
    const codes = [sourceLocale, ...targetLocales.filter((c) => c !== sourceLocale)]
    const meta = {}
    for (const code of codes) {
        meta[code] = DEFAULT_LOCALE_META[code] || {
            file: `${code}.json`,
            code,
            name: code,
            nameZh: code
        }
    }
    return meta
}

export function createContextFromConfig(config) {
    const root = config.root
    const localesDir = path.isAbsolute(config.localesDir)
        ? config.localesDir
        : path.join(root, config.localesDir)
    const reportsDir = path.isAbsolute(config.reportsDir)
        ? config.reportsDir
        : path.join(root, config.reportsDir)
    const includeAbs = config.include.map((p) =>
        path.isAbsolute(p) ? p : path.join(root, p)
    )
    const localeMeta = buildLocaleMeta(config.targetLocales, config.sourceLocale)
    const localeCodes = Object.keys(localeMeta)

    return {
        root,
        localesDir,
        reportsDir,
        include: config.include,
        includeAbs,
        exclude: new Set(config.exclude),
        sourceLocale: config.sourceLocale,
        targetLocales: config.targetLocales,
        localeMeta,
        localeCodes,
        replace: config.replace,
        translate: config.translate,
        tImportFrom: config.tImportFrom
    }
}
