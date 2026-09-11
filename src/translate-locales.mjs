/**
 * 将除 zh-CN / en-US 外的语言包从「中文占位」补成目标语言译文。
 * 只改仍是中文（或与 zh 相同）的条目，不覆盖已有译文。以 en-US 作兜底源文。
 *
 * Usage:
 *   node scripts/i18n-translate-locales.mjs --check
 *   node scripts/i18n-translate-locales.mjs --all
 *   node scripts/i18n-translate-locales.mjs --locale=de-DE,fr-FR
 *   node scripts/i18n-translate-locales.mjs --all --delay=200 --concurrency=2
 *   node scripts/i18n-translate-locales.mjs --all --limit=30
 *   node scripts/i18n-translate-locales.mjs --all --keys-file=reports/i18n-changed-keys.json
 */

import fs from 'fs'
import path from 'path'
import {
    loadLocale,
    saveLocale,
    isMetaKey
} from './locale-io.mjs'
import { getContext } from './context.mjs'

const CN_CHAR = /[\u4e00-\u9fff]/

/** locale → 有道 to 码；null 表示有道不支持，走 MyMemory */
const YOUDAO_TO = {
    'de-DE': 'de',
    'ru-RU': 'ru',
    'hi-IN': null,
    'es-ES': 'es',
    'ar-SA': 'ar',
    'fr-FR': 'fr',
    'bn-BD': null,
    'pt-BR': 'pt',
    'id-ID': 'id',
    'ja-JP': 'ja',
    'ko-KR': 'ko'
}

/** MyMemory langpair 右侧 */
const MYMEMORY_TO = {
    'de-DE': 'de',
    'ru-RU': 'ru',
    'hi-IN': 'hi',
    'es-ES': 'es',
    'ar-SA': 'ar',
    'fr-FR': 'fr',
    'bn-BD': 'bn',
    'pt-BR': 'pt',
    'id-ID': 'id',
    'ja-JP': 'ja',
    'ko-KR': 'ko'
}

function getTargetLocales() {
    const { sourceLocale, localeCodes } = getContext()
    return localeCodes.filter((c) => c !== sourceLocale && c !== 'en-US')
}

function loadKeysFilter(filePath) {
    if (!filePath) return null
    const { root } = getContext()
    const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
    if (!fs.existsSync(abs)) throw new Error(`keys file not found: ${abs}`)
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8') || '[]')
    const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.texts)
          ? raw.texts
          : Array.isArray(raw.keys)
            ? raw.keys
            : Array.isArray(raw.added)
              ? raw.added
              : []
    return new Set(list.map(String).filter(Boolean))
}

function parseArgs(argv) {
    const opts = {
        check: false,
        all: false,
        locales: [],
        delayMs: 400,
        concurrency: 1,
        limit: Infinity,
        saveEvery: 40,
        keysFile: null,
        keysFilter: null
    }
    for (const arg of argv) {
        if (arg === '--check') opts.check = true
        else if (arg === '--all') opts.all = true
        else if (arg.startsWith('--locale=')) {
            opts.locales = arg
                .slice('--locale='.length)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        } else if (arg.startsWith('--delay=')) opts.delayMs = Number(arg.split('=')[1]) || 220
        else if (arg.startsWith('--concurrency='))
            opts.concurrency = Math.max(1, Number(arg.split('=')[1]) || 2)
        else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || Infinity
        else if (arg.startsWith('--save-every='))
            opts.saveEvery = Math.max(1, Number(arg.split('=')[1]) || 25)
        else if (arg.startsWith('--keys-file=')) opts.keysFile = arg.slice('--keys-file='.length)
        else if (arg.startsWith('--keys=')) {
            // 逗号分隔；少量 key 时可直接传
            opts.keysFilter = new Set(
                arg
                    .slice('--keys='.length)
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
            )
        }
    }
    if (!opts.all && !opts.locales.length && !opts.check) opts.all = true
    // --locale= 优先于 --all（npm script 默认带 --all 时仍可限定语言）
    const TARGET_LOCALES = getTargetLocales()
    if (opts.all && !opts.locales.length) opts.locales = [...TARGET_LOCALES]
    opts.locales = opts.locales.filter((c) => TARGET_LOCALES.includes(c))
    if (opts.keysFile) opts.keysFilter = loadKeysFilter(opts.keysFile)
    return opts
}

function looksChinese(text) {
    return typeof text === 'string' && CN_CHAR.test(text)
}

/** 单位/品牌/中英同形短词：允许与 en 相同，不算未译 */
function isInternationalism(text) {
    if (typeof text !== 'string' || !text || looksChinese(text)) return false
    const s = text.trim()
    if (s.length > 40) return false
    if (/^(km|cm|m|m²|m³|kg|mm|t|%|℃|X|Y|PC|URL|GPS|OK|H5|CSV|PDF|OSS)$/i.test(s)) return true
    if (/(Cloud OSS|WeChat|Microsoft YaHei|Alibaba|Tencent|Vögele|EZVIZ|Open Platform|Pay)/i.test(s))
        return true
    // 单/双词拉丁同形（Menu/Cache/Status/Normal/Online/Silo/Zoom…；含冒号/括号/插值）
    if (
        /^[A-Za-z][A-Za-z0-9]*(?:[ :.\-][A-Za-z0-9{}_]*)*(?:\s*\([^)]*\))?$/.test(s) &&
        s.length <= 28
    )
        return true
    return false
}

function needsTranslation(key, value, zhValue, enValue, locale = '') {
    if (value == null || value === '') return true
    if (zhValue != null && value === zhValue) return true
    // ja/ko 译文常含汉字/汉字词，不能按「含 CJK = 未译」误判；仅追 en 兜底
    if (locale === 'ja-JP' || locale === 'ko-KR') {
        if (enValue && value === enValue && enValue !== zhValue && !isInternationalism(value))
            return true
        return false
    }
    if (looksChinese(value)) return true
    // en-US 兜底占位，仍需译为目标语言（单位/品牌/同形短词除外）
    if (enValue && value === enValue && enValue !== zhValue && !isInternationalism(value)) return true
    return false
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

async function translateViaYoudao(text, to) {
    const body = new URLSearchParams({
        q: text,
        from: 'zh-CHS',
        to
    })
    for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 8000)
        try {
            const res = await fetch('https://aidemo.youdao.com/trans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
                signal: ctrl.signal
            })
            if (!res.ok) throw new Error(`youdao HTTP ${res.status}`)
            const data = await res.json()
            if (String(data.errorCode) === '0' && data.translation?.[0]) {
                return String(data.translation[0])
            }
            if (String(data.errorCode) === '411' || String(data.errorCode) === '429') {
                await sleep(1500 * (attempt + 1))
                continue
            }
            throw new Error(`youdao errorCode=${data.errorCode}`)
        } finally {
            clearTimeout(timer)
        }
    }
    throw new Error('youdao errorCode=411')
}

let youdaoBlocked = false
let mymemoryEmailIndex = 0
const MYMEMORY_EMAIL_POOL = Array.from({ length: 30 }, (_, i) => `i18n${i + 1}@example.com`)

function nextMyMemoryEmail() {
    const email = MYMEMORY_EMAIL_POOL[mymemoryEmailIndex % MYMEMORY_EMAIL_POOL.length]
    mymemoryEmailIndex++
    return email
}

async function translateViaMyMemory(text, langpair, email) {
    const url =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(text) +
        '&langpair=' +
        langpair +
        '&de=' +
        encodeURIComponent(email)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    try {
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`mymemory HTTP ${res.status}`)
        const data = await res.json()
        const out = data?.responseData?.translatedText
        if (!out) throw new Error('mymemory empty')
        if (/MYMEMORY WARNING|QUOTA|MusicBrainz/i.test(out)) {
            throw new Error(`mymemory: ${out.slice(0, 60)}`)
        }
        return String(out)
    } finally {
        clearTimeout(timer)
    }
}

async function tryMyMemory(text, langpair) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const email = nextMyMemoryEmail()
        try {
            return await translateViaMyMemory(text, langpair, email)
        } catch (e) {
            if (/429|quota|WARNING|abort/i.test(e.message) && attempt < 1) {
                await sleep(400 * (attempt + 1))
                continue
            }
            throw e
        }
    }
    throw new Error('mymemory: quota exhausted')
}

/**
 * 优先：有道(中文→目标)；MyMemory(英文→目标)；MyMemory(中文→目标)
 * （MyMemory 常超时，有道对 fr/pt 更稳更快）
 */
async function translateOne(key, zhValue, enValue, locale) {
    const youdaoTo = YOUDAO_TO[locale]
    const mmTo = MYMEMORY_TO[locale]
    const errors = []
    const enSrc = enValue && !looksChinese(enValue) ? enValue : null

    if (youdaoTo && !youdaoBlocked) {
        try {
            const src = looksChinese(zhValue) ? zhValue : key
            const out = await translateViaYoudao(src, youdaoTo)
            if (out && !looksChinese(out)) return out
            errors.push('youdao: still chinese')
        } catch (e) {
            errors.push(`youdao: ${e.message}`)
            if (/411|429/.test(e.message)) youdaoBlocked = true
        }
    }

    if (enSrc && mmTo) {
        try {
            const out = await tryMyMemory(enSrc, `en|${mmTo}`)
            if (out && !looksChinese(out)) return out
            errors.push('mymemory-en: still chinese')
        } catch (e) {
            errors.push(`mymemory-en: ${e.message}`)
        }
    }

    if (mmTo) {
        try {
            const src = looksChinese(zhValue) ? zhValue : key
            const out = await tryMyMemory(src, `zh-CN|${mmTo}`)
            if (out && !looksChinese(out)) return out
            errors.push('mymemory-zh: still chinese')
        } catch (e) {
            errors.push(`mymemory-zh: ${e.message}`)
        }
    }

    // API 不可用时暂用英文，优于中文占位（配额恢复后再次执行会继续译成目标语言）
    if (enSrc) return enSrc

    throw new Error(errors.join(' | '))
}

function pendingKeys(zh, en, pack, keysFilter = null, locale = '') {
    const list = []
    const sourceKeys = keysFilter ? [...keysFilter] : Object.keys(zh)
    for (const key of sourceKeys) {
        if (isMetaKey(key)) continue
        if (!(key in zh)) continue
        if (needsTranslation(key, pack[key], zh[key], en[key], locale)) list.push(key)
    }
    return list
}

async function fillLocale(locale, zh, en, opts) {
    const pack = loadLocale(locale)
    let pending = pendingKeys(zh, en, pack, opts.keysFilter, locale)
    const totalPending = pending.length
    if (opts.limit < pending.length) pending = pending.slice(0, opts.limit)

    console.log(
        `\n[i18n:fill-locales] ${locale}: pending=${totalPending}, this run=${pending.length}`
    )
    if (opts.check || pending.length === 0) {
        return { locale, pending: totalPending, ok: 0, fail: 0 }
    }

    let ok = 0
    let fail = 0
    let consecutiveFail = 0
    const cache = new Map()

    for (let i = 0; i < pending.length; ) {
        if (consecutiveFail >= 80) {
            console.warn(
                `[i18n:fill-locales] ${locale} stopped: too many consecutive errors. Re-run to resume.`
            )
            break
        }

        const batch = pending.slice(i, i + opts.concurrency)
        const results = await Promise.all(
            batch.map(async (key) => {
                const zhValue = zh[key]
                const enValue = en[key]
                const cacheKey = `${enValue || ''}\n${zhValue || key}`
                try {
                    let translated = cache.get(cacheKey)
                    if (!translated) {
                        translated = await translateOne(key, zhValue, enValue, locale)
                        cache.set(cacheKey, translated)
                    }
                    return { key, translated, error: null }
                } catch (e) {
                    return { key, translated: null, error: e }
                }
            })
        )

        for (const r of results) {
            if (r.translated) {
                pack[r.key] = r.translated
                ok++
                consecutiveFail = 0
            } else {
                fail++
                consecutiveFail++
                if (fail <= 8 || fail % 50 === 0) {
                    console.warn(
                        `[i18n:fill-locales] ${locale} skip: ${String(r.key).slice(0, 36)} (${r.error?.message})`
                    )
                }
            }
        }

        i += batch.length
        if (i % opts.saveEvery < opts.concurrency || i >= pending.length) {
            saveLocale(locale, pack)
            console.log(
                `[i18n:fill-locales] ${locale} progress ${i}/${pending.length} ok=${ok} fail=${fail}`
            )
        }
        await sleep(opts.delayMs)
    }

    saveLocale(locale, pack)
    const left = pendingKeys(zh, en, pack, opts.keysFilter, locale).length
    console.log(`[i18n:fill-locales] ${locale} done: ok=${ok} fail=${fail} stillPending=${left}`)
    return { locale, pending: left, ok, fail }
}

export async function runTranslateLocales(argv = []) {
    const opts = parseArgs(argv)
    const { root, reportsDir, sourceLocale } = getContext()
    const TARGET_LOCALES = getTargetLocales()
    const zh = loadLocale(sourceLocale)
    const en = loadLocale('en-US')

    console.log(`[i18n:fill-locales] zh keys=${Object.keys(zh).length}`)
    console.log(`[i18n:fill-locales] targets=${opts.locales.join(',') || '(none)'}`)
    console.log(
        `[i18n:fill-locales] delay=${opts.delayMs}ms concurrency=${opts.concurrency} limit=${opts.limit}`
    )
    if (opts.keysFilter) {
        console.log(`[i18n:fill-locales] keys filter: ${opts.keysFilter.size} (changed-scope only)`)
    }

    if (opts.check) {
        for (const locale of opts.locales.length ? opts.locales : TARGET_LOCALES) {
            const pack = loadLocale(locale)
            const n = pendingKeys(zh, en, pack, opts.keysFilter, locale).length
            console.log(`  ${locale}: pending=${n}`)
        }
        return
    }

    const summary = []
    for (const locale of opts.locales) {
        summary.push(await fillLocale(locale, zh, en, opts))
    }

    const reportPath = path.join(reportsDir, 'i18n-fill-locales.json')
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), summary }, null, 2))
    console.log(`\n[i18n:fill-locales] report -> ${path.relative(root, reportPath)}`)
    console.log('[i18n:fill-locales] tip: re-run the same command to resume unfinished keys')
}
