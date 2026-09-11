/**
 * Git-changed files → extract → sync → scoped translate.
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getContext } from './context.mjs'
import { runExtract } from './extract.mjs'
import { runSync } from './sync.mjs'
import { runOfflineEn } from './offline-en.mjs'
import { runTranslateEn } from './translate-en.mjs'
import { runTranslateLocales } from './translate-locales.mjs'

const SRC_RE = /\.(vue|ts|js|tsx|jsx)$/i

function parseArgs(argv) {
    const opts = {
        dry: false,
        staged: false,
        fillAll: false,
        noTranslate: false,
        onlineEn: false
    }
    for (const arg of argv) {
        if (arg === '--dry') opts.dry = true
        else if (arg === '--staged') opts.staged = true
        else if (arg === '--fill-all' || arg === '--locales' || arg === '--translate') {
            opts.fillAll = true
        } else if (arg === '--no-translate') opts.noTranslate = true
        else if (arg === '--online-en') opts.onlineEn = true
        else if (arg === '--help' || arg === '-h') {
            console.log(`Usage: i18n-auto changed [--dry] [--staged] [--no-translate] [--fill-all] [--online-en]
  --dry            scan only, no write
  --staged         only staged git changes
  --no-translate   skip online translate
  --fill-all       translate full locale backlog
  --online-en      force online for all pending English`)
            process.exit(0)
        }
    }
    return opts
}

function findGitRoot(start) {
    let dir = path.resolve(start)
    for (;;) {
        if (fs.existsSync(path.join(dir, '.git'))) return dir
        const parent = path.dirname(dir)
        if (parent === dir) return start
        dir = parent
    }
}

function runGit(gitRoot, args) {
    const r = spawnSync('git', args, {
        cwd: gitRoot,
        encoding: 'utf8',
        shell: false
    })
    if (r.status !== 0) {
        const err = (r.stderr || r.stdout || '').trim()
        throw new Error(`git ${args.join(' ')} failed: ${err || `exit ${r.status}`}`)
    }
    return (r.stdout || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function runGitRaw(gitRoot, args) {
    const r = spawnSync('git', args, {
        cwd: gitRoot,
        encoding: 'utf8',
        shell: false
    })
    if (r.status !== 0) {
        const err = (r.stderr || r.stdout || '').trim()
        throw new Error(`git ${args.join(' ')} failed: ${err || `exit ${r.status}`}`)
    }
    return r.stdout || ''
}

function toProjectRel(repoRel, { root, gitRoot }) {
    const norm = repoRel.replace(/\\/g, '/').replace(/^\.\//, '')
    const abs = path.resolve(gitRoot, norm)
    const rel = path.relative(root, abs).replace(/\\/g, '/')
    if (!rel || rel.startsWith('..')) return null
    return rel
}

function matchesInclude(rel, include) {
    const n = rel.replace(/\\/g, '/')
    return include.some((inc) => {
        const i = inc.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
        return n === i || n.startsWith(i + '/')
    })
}

function collectChangedFiles({ staged, root, gitRoot, include, localesDir }) {
    const names = new Set()
    for (const f of runGit(gitRoot, ['ls-files', '--others', '--exclude-standard'])) {
        names.add(f)
    }
    if (staged) {
        for (const f of runGit(gitRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])) {
            names.add(f)
        }
    } else {
        for (const f of runGit(gitRoot, ['diff', '--name-only', '--diff-filter=ACMR'])) {
            names.add(f)
        }
        for (const f of runGit(gitRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])) {
            names.add(f)
        }
    }

    const localesRel = path.relative(root, localesDir).replace(/\\/g, '/')
    const out = []
    for (const repoRel of names) {
        const rel = toProjectRel(repoRel, { root, gitRoot })
        if (!rel) continue
        if (!SRC_RE.test(rel)) continue
        if (/\.d\.ts$/i.test(rel)) continue
        if (localesRel && (rel === localesRel || rel.startsWith(localesRel + '/'))) continue
        if (!matchesInclude(rel, include)) continue
        const abs = path.join(root, rel)
        if (!fs.existsSync(abs)) continue
        out.push(rel)
    }
    return [...new Set(out)].sort()
}

function normalizeKey(raw) {
    return String(raw || '')
        .replace(/\s+/g, ' ')
        .trim()
}

const CN_CHAR = /[\u4e00-\u9fff]/
const CN_TEXT =
    /[\u4e00-\u9fff][\u4e00-\u9fff\w\s，。！？、：；""''（）【】《》·…—\-～,.!?:;()[\]{}/%＋+=]*/g

function extractChineseKeysFromLine(line) {
    const keys = new Set()
    if (!line || !CN_CHAR.test(line)) return keys

    const isHtmlKey = (text) =>
        /<\/?[a-zA-Z]|\bbr\s*\/?>/i.test(text) || /^["']?>|<\/[a-zA-Z]/.test(text)

    const isJunkKey = (text) =>
        /console\.log|btnItem\.|function\s*\(|=>\s*\{|\.Format\(|\$\{|item\.label|row\.|innerHTML|domString/.test(
            text
        ) ||
        /^(['"])[\s\S]*\1$/.test(text) ||
        /^[,:)\]}]/.test(text) ||
        /^[\u4e00-\u9fffA-Za-z0-9]+\[$/.test(text) ||
        /^\]/.test(text) ||
        /^米\]/.test(text) ||
        /^0\s*\?/.test(text)

    const wrappedRe = /(?:\$t|i18n\.t|\bt)\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g
    let m
    while ((m = wrappedRe.exec(line))) {
        const text = normalizeKey(m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"'))
        if (text && CN_CHAR.test(text) && text.length <= 80 && !isHtmlKey(text) && !isJunkKey(text))
            keys.add(text)
    }

    const quoteRe = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
    while ((m = quoteRe.exec(line))) {
        if (m[1] === '`' && m[2].includes('${')) continue
        const text = normalizeKey(m[2].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"'))
        if (text && CN_CHAR.test(text) && text.length <= 80 && !isHtmlKey(text) && !isJunkKey(text))
            keys.add(text)
    }

    const cleaned = line
        .replace(/\{\{\s*\$t\([^)]+\)\s*\}\}/g, ' ')
        .replace(/(?:\$t|i18n\.t|\bt)\([^)]*\)/g, ' ')
        .replace(/<[^>]+>/g, ' ')
    for (const hit of cleaned.match(CN_TEXT) || []) {
        const text = normalizeKey(hit)
        if (text && text.length <= 80 && !isHtmlKey(text) && !isJunkKey(text)) keys.add(text)
    }

    return keys
}

function collectKeysFromGitDiff(files, { staged, root, gitRoot }) {
    const keys = new Set()
    const untracked = new Set(runGit(gitRoot, ['ls-files', '--others', '--exclude-standard']))

    for (const rel of files) {
        const abs = path.join(root, rel)
        const repoRel = path.relative(gitRoot, abs).replace(/\\/g, '/')
        const isUntracked =
            untracked.has(repoRel) ||
            untracked.has(rel) ||
            untracked.has(rel.replace(/\\/g, '/'))

        if (isUntracked) {
            if (!fs.existsSync(abs)) continue
            for (const line of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
                for (const k of extractChineseKeysFromLine(line)) keys.add(k)
            }
            continue
        }

        const tryPaths = [repoRel, rel]
        let diff = ''
        for (const p of tryPaths) {
            try {
                diff = runGitRaw(
                    gitRoot,
                    staged ? ['diff', '--cached', '-U0', '--', p] : ['diff', 'HEAD', '-U0', '--', p]
                )
                if (diff) break
            } catch {
                /* try next */
            }
        }

        for (const line of diff.split(/\r?\n/)) {
            if (!line.startsWith('+') || line.startsWith('+++')) continue
            for (const k of extractChineseKeysFromLine(line.slice(1))) keys.add(k)
        }
    }

    return [...keys]
}

function writeChangedKeysFile(files, opts, extractReportPath, changedKeysPath) {
    const { root, gitRoot } = opts
    const keys = new Set()

    for (const k of collectKeysFromGitDiff(files, opts)) keys.add(k)

    if (fs.existsSync(extractReportPath)) {
        try {
            const report = JSON.parse(fs.readFileSync(extractReportPath, 'utf8') || '{}')
            if (Array.isArray(report.added)) {
                for (const t of report.added) {
                    const k = normalizeKey(t)
                    if (k) keys.add(k)
                }
            }
        } catch {
            console.warn('[i18n:changed] extract report invalid JSON, ignore')
        }
    }

    const list = [...keys]
    fs.mkdirSync(path.dirname(changedKeysPath), { recursive: true })
    fs.writeFileSync(
        changedKeysPath,
        JSON.stringify(
            {
                at: new Date().toISOString(),
                count: list.length,
                texts: list,
                files
            },
            null,
            2
        ),
        'utf8'
    )

    console.log(
        `[i18n:changed] scoped keys: ${list.length} -> ${path.relative(root, changedKeysPath)}`
    )
    if (list.length) {
        for (const k of list.slice(0, 20)) console.log(`  · ${k}`)
        if (list.length > 20) console.log(`  · … +${list.length - 20} more`)
    }
    return list
}

export async function runChanged(argv = []) {
    const opts = parseArgs(argv)
    const ctx = getContext()
    const gitRoot = findGitRoot(ctx.root)
    const extractReportPath = path.join(ctx.reportsDir, 'i18n-extract.json')
    const changedKeysPath = path.join(ctx.reportsDir, 'i18n-changed-keys.json')

    let files
    try {
        files = collectChangedFiles({
            staged: opts.staged,
            root: ctx.root,
            gitRoot,
            include: ctx.include,
            localesDir: ctx.localesDir
        })
    } catch (e) {
        console.error(`[i18n:changed] ${e.message}`)
        process.exit(1)
    }

    if (!files.length) {
        console.log('[i18n:changed] no changed source files in include paths')
        console.log('[i18n:changed] tip: edit vue/ts files first, or use i18n-auto scan [path]')
        return
    }

    console.log(`[i18n:changed] ${files.length} file(s):`)
    for (const f of files) console.log(`  - ${f}`)

    const extractArgs = []
    if (!opts.dry) extractArgs.push('--write')
    if (ctx.replace === false) extractArgs.push('--no-replace')
    for (const f of files) extractArgs.push(`--path=${f}`)

    runExtract(extractArgs)

    if (opts.dry) {
        console.log('\n[i18n:changed] dry-run done (no sync/translate)')
        return
    }

    const keys = writeChangedKeysFile(
        files,
        { staged: opts.staged, root: ctx.root, gitRoot },
        extractReportPath,
        changedKeysPath
    )
    const keysRel = path.relative(ctx.root, changedKeysPath).replace(/\\/g, '/')

    runSync()

    const shouldTranslate = !opts.noTranslate && ctx.translate !== false

    if (opts.onlineEn) {
        await runTranslateEn(['--auto', '--delay=500'])
    } else {
        runOfflineEn([])
        if (shouldTranslate && keys.length) {
            await runTranslateEn(['--auto', '--delay=300', `--keys-file=${keysRel}`])
        }
    }

    if (opts.fillAll) {
        await runTranslateLocales(['--all', '--delay=200', '--concurrency=2'])
    } else if (shouldTranslate && keys.length) {
        await runTranslateLocales([
            '--all',
            '--delay=200',
            '--concurrency=2',
            `--keys-file=${keysRel}`
        ])
    } else if (shouldTranslate && !keys.length) {
        console.log('[i18n:changed] no Chinese keys in changed files, skip online translate')
    }

    console.log('\n[i18n:changed] done')
    if (opts.noTranslate) {
        console.log('[i18n:changed] tip: omit --no-translate to auto-translate scoped keys')
    } else if (!opts.fillAll) {
        console.log(
            '[i18n:changed] tip: only translated keys from changed files; use --fill-all for full backlog'
        )
    }
}
