/**
 * Full-directory / path scan + optional translate pipeline.
 */

import fs from 'fs'
import path from 'path'
import { getContext } from './context.mjs'
import { runExtract } from './extract.mjs'
import { runSync } from './sync.mjs'
import { runOfflineEn } from './offline-en.mjs'
import { runTranslateEn } from './translate-en.mjs'
import { runTranslateLocales } from './translate-locales.mjs'

function parseScanArgs(argv) {
    const opts = {
        dry: false,
        noReplace: false,
        noTranslate: false,
        paths: []
    }
    for (const arg of argv) {
        if (arg === '--dry') opts.dry = true
        else if (arg === '--no-replace') opts.noReplace = true
        else if (arg === '--no-translate') opts.noTranslate = true
        else if (arg === '--help' || arg === '-h') opts.help = true
        else if (!arg.startsWith('-')) opts.paths.push(arg)
    }
    return opts
}

export async function runScan(argv = []) {
    const opts = parseScanArgs(argv)
    if (opts.help) {
        console.log(`Usage: i18n-auto scan [path...] [--dry] [--no-replace] [--no-translate]`)
        return
    }

    const ctx = getContext()
    const extractArgs = []
    if (!opts.dry) extractArgs.push('--write')
    if (opts.noReplace || ctx.replace === false) extractArgs.push('--no-replace')

    const paths = opts.paths.length ? opts.paths : ctx.include
    for (const p of paths) extractArgs.push(`--path=${p}`)

    const report = runExtract(extractArgs)

    if (opts.dry) {
        console.log('\n[i18n-auto scan] dry-run done')
        return report
    }

    runSync()
    runOfflineEn([])

    const shouldTranslate = !opts.noTranslate && ctx.translate !== false
    if (shouldTranslate) {
        const scanKeysPath = path.join(ctx.reportsDir, 'i18n-scan-keys.json')
        const texts =
            Array.isArray(report?.added) && report.added.length
                ? report.added
                : Array.isArray(report?.texts)
                  ? report.texts
                  : []
        fs.mkdirSync(ctx.reportsDir, { recursive: true })
        fs.writeFileSync(
            scanKeysPath,
            JSON.stringify(
                { at: new Date().toISOString(), count: texts.length, texts },
                null,
                2
            ),
            'utf8'
        )
        const keysRel = path.relative(ctx.root, scanKeysPath).replace(/\\/g, '/')
        if (texts.length) {
            await runTranslateEn(['--auto', '--delay=300', `--keys-file=${keysRel}`])
            await runTranslateLocales([
                '--all',
                '--delay=200',
                '--concurrency=2',
                `--keys-file=${keysRel}`
            ])
        } else {
            console.log('[i18n-auto scan] no new/pending keys, skip online translate')
        }
    } else {
        console.log('[i18n-auto scan] skip online translate (--no-translate or translate:false)')
    }

    console.log('\n[i18n-auto scan] done')
    return report
}
