/**
 * Load i18nAuto from the consumer project's vite.config.*
 */

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { DEFAULT_I18N_AUTO } from './defaults.mjs'

const VITE_CONFIG_NAMES = [
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'vite.config.cts'
]

export function findProjectRoot(cwd = process.cwd()) {
    let dir = path.resolve(cwd)
    for (;;) {
        if (VITE_CONFIG_NAMES.some((n) => fs.existsSync(path.join(dir, n)))) return dir
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            // Prefer a directory that also has vite config; otherwise keep walking
            const parent = path.dirname(dir)
            if (parent === dir) return cwd
            // If parent has vite config, continue; if this pkg.json is enough and no vite up, use dir
            let hasViteUp = false
            let walk = parent
            while (walk !== path.dirname(walk)) {
                if (VITE_CONFIG_NAMES.some((n) => fs.existsSync(path.join(walk, n)))) {
                    hasViteUp = true
                    break
                }
                walk = path.dirname(walk)
            }
            if (!hasViteUp) return dir
        }
        const parent = path.dirname(dir)
        if (parent === dir) return cwd
        dir = parent
    }
}

export function findViteConfig(root) {
    for (const name of VITE_CONFIG_NAMES) {
        const p = path.join(root, name)
        if (fs.existsSync(p)) return p
    }
    return null
}

function mergeI18nAuto(raw = {}) {
    return {
        ...DEFAULT_I18N_AUTO,
        ...raw,
        include: Array.isArray(raw.include) && raw.include.length ? raw.include : DEFAULT_I18N_AUTO.include,
        exclude: Array.isArray(raw.exclude) ? raw.exclude : DEFAULT_I18N_AUTO.exclude,
        targetLocales:
            Array.isArray(raw.targetLocales) && raw.targetLocales.length
                ? raw.targetLocales
                : DEFAULT_I18N_AUTO.targetLocales
    }
}

async function loadWithVite(configPath, root) {
    let loadConfigFromFile
    try {
        ;({ loadConfigFromFile } = await import('vite'))
    } catch {
        const viteEntry = pathToFileURL(
            path.join(root, 'node_modules/vite/dist/node/index.js')
        ).href
        ;({ loadConfigFromFile } = await import(viteEntry))
    }
    const result = await loadConfigFromFile(
        { command: 'serve', mode: 'development' },
        configPath,
        root
    )
    return result?.config || {}
}

async function loadWithDynamicImport(configPath) {
    const mod = await import(pathToFileURL(configPath).href)
    const exported = mod.default ?? mod
    return typeof exported === 'function' ? await exported({ command: 'serve', mode: 'development' }) : exported
}

/**
 * @returns {Promise<{ root: string, configPath: string|null, i18nAuto: object, viteConfig: object }>}
 */
export async function loadProjectConfig(cwd = process.cwd()) {
    const root = findProjectRoot(cwd)
    const configPath = findViteConfig(root)
    let viteConfig = {}

    if (configPath) {
        const isTs = /\.tsx?$|\.cts$|\.mts$/i.test(configPath)
        try {
            if (isTs) {
                viteConfig = await loadWithVite(configPath, root)
            } else {
                try {
                    viteConfig = await loadWithDynamicImport(configPath)
                } catch {
                    viteConfig = await loadWithVite(configPath, root)
                }
            }
        } catch (e) {
            console.warn(
                `[i18n-auto] failed to load ${path.relative(root, configPath)}: ${e.message}`
            )
            console.warn('[i18n-auto] falling back to default i18nAuto config')
        }
    } else {
        console.warn('[i18n-auto] no vite.config found; using default i18nAuto')
    }

    const i18nAuto = mergeI18nAuto(viteConfig.i18nAuto || {})
    return {
        root,
        configPath,
        i18nAuto: { ...i18nAuto, root },
        viteConfig
    }
}
