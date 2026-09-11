/**
 * 扫描源码中未走 i18n 的中文文案：
 * 1. 写入 locales/*.json（zh-CN 为原文；其他语言缺 key 时先占位为中文）
 * 2. 可选：将源码替换为 $t() / t()
 *
 * Usage:
 *   node scripts/i18n-extract.mjs                     # dry-run，默认扫 src
 *   node scripts/i18n-extract.mjs --path=src/layout   # 限定目录
 *   node scripts/i18n-extract.mjs --path=src/layout --write
 *   node scripts/i18n-extract.mjs --write --no-replace  # 只写语言包，不改页面
 */

import fs from 'fs'
import path from 'path'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { LOCALE_CODES, loadLocale, saveLocale, isMetaKey } from './locale-io.mjs'
import { getContext } from './context.mjs'

const CN_CHAR = /[\u4e00-\u9fff]/
/** 至少含一个汉字的可读文案（允许常见标点/数字/字母混排） */
const CN_TEXT = /[\u4e00-\u9fff][\u4e00-\u9fff\w\s，。！？、：；""''（）【】《》·…—\-～,.!?:;()[\]{}/%＋+=]*/

const EXCLUDE_FILE_RE = /\.(d\.ts|min\.js|map|css|scss|svg|png|jpg|jpeg|gif|webp|csv)$/i

function parseArgs(argv) {
    const { root, includeAbs, reportsDir, replace } = getContext()
    const opts = {
        write: false,
        replace,
        scanPaths: [],
        report: path.join(reportsDir, 'i18n-extract.json')
    }
    for (const arg of argv) {
        if (arg === '--write') opts.write = true
        else if (arg === '--dry') opts.write = false
        else if (arg === '--no-replace') opts.replace = false
        else if (arg.startsWith('--path=')) {
            const p = arg.slice('--path='.length)
            opts.scanPaths.push(path.isAbsolute(p) ? p : path.join(root, p))
        } else if (arg.startsWith('--files=')) {
            for (const part of arg.slice('--files='.length).split(',')) {
                const p = part.trim()
                if (!p) continue
                opts.scanPaths.push(path.isAbsolute(p) ? p : path.join(root, p))
            }
        } else if (arg.startsWith('--report=')) {
            const p = arg.slice('--report='.length)
            opts.report = path.isAbsolute(p) ? p : path.join(root, p)
        }
    }
    if (!opts.scanPaths.length) opts.scanPaths = [...includeAbs]
    return opts
}

function walk(dir, files = []) {
    const { exclude } = getContext()
    if (!fs.existsSync(dir)) return files
    const stat = fs.statSync(dir)
    if (stat.isFile()) {
        const name = path.basename(dir)
        if (/\.(vue|ts|js|tsx|jsx)$/.test(name) && !EXCLUDE_FILE_RE.test(name)) {
            files.push(dir)
        }
        return files
    }
    for (const name of fs.readdirSync(dir)) {
        if (exclude.has(name)) continue
        const full = path.join(dir, name)
        const st = fs.statSync(full)
        if (st.isDirectory()) walk(full, files)
        else if (/\.(vue|ts|js|tsx|jsx)$/.test(name) && !EXCLUDE_FILE_RE.test(name)) {
            files.push(full)
        }
    }
    return files
}

function tImportFrom() {
    return getContext().tImportFrom || '@/locales'
}

function normalizeText(raw) {
    return raw.replace(/\s+/g, ' ').trim()
}

function isSkippableText(text) {
    if (!text || !CN_CHAR.test(text)) return true
    if (text.length > 80) return true // 过长段落跳过，避免误抽注释/大块文案
    // 纯注释风格 / 日志
    if (/^(TODO|FIXME|NOTE|BUG)/i.test(text)) return true
    // 含 HTML 标签的整段（只抽纯中文，标签留在模板里）
    if (/<\/?[a-zA-Z]|\bbr\s*\/?>/i.test(text)) return true
    if (/^["']?>|<\/[a-zA-Z]/.test(text)) return true
    // 代码片段 / 表达式 / 模板拼接（误抽）
    if (/console\.log|btnItem\.|function\s*\(|=>\s*\{|\.Format\(/.test(text)) return true
    if (/\$\{/.test(text) || /`[^`]*`\s*\+/.test(text) || /\+\s*item\./.test(text)) return true
    if (/item\.label\s*==|row\.|getQueryString|innerHTML|domString/.test(text)) return true
    if (/item\s*[!=<>+]|cell\.legend|daily\.data|getTableColumns\s*:/.test(text)) return true
    if (/^\s*`/.test(text) && /`$/.test(text)) return true
    if (/^(['"])[\s\S]*\1$/.test(text)) return true // "'中文'" 外层引号
    if (/^[,:)\]}]/.test(text)) return true // 代码碎片开头
    if (/^[\u4e00-\u9fffA-Za-z0-9]+\[$/.test(text)) return true // 车辆[
    if (/^\]/.test(text) || /^米\]/.test(text)) return true
    if (/^0\s*\?/.test(text)) return true
    // 英文标识前缀 + 中文：Foo: 中文 → 应由人工拆成纯中文，不整段入库
    if (/^[A-Za-z][A-Za-z0-9_]*\s*:/.test(text) && CN_CHAR.test(text)) return true
    return false
}

function alreadyWrapped(source, index) {
    const left = source.slice(Math.max(0, index - 40), index)
    return /(?:\$t|i18n\.t|\bt)\(\s*['"`]\s*$/.test(left) || /(?:\$t|i18n\.t|\bt)\([^)]*$/.test(left)
}

/** 去掉 //、/* *\/、<!-- --> 注释，便于扫描（替换时用原文） */
function stripCommentsForScan(code, isTemplate = false) {
    let out = code
    if (isTemplate) {
        out = out.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    }
    out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    out = out.replace(/(^|[^:])\/\/.*$/gm, (m) => ' '.repeat(m.length))
    return out
}

function collectFromQuotedStrings(code, bag) {
    const scan = stripCommentsForScan(code, false)
    const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
    let m
    while ((m = re.exec(scan))) {
        const quote = m[1]
        const body = m[2]
        if (quote === '`') {
            // 模板字符串含插值时暂不自动替换，只收集纯中文模板串
            if (body.includes('${')) continue
        }
        const text = normalizeText(body.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"'))
        if (isSkippableText(text)) continue
        if (isLikelyExpressionKey(text)) continue
        // 已是 i18n 调用整体（如 :title="$t('主题设置')" 的属性值）
        if (/\$t\s*\(|\bi18n\.t\s*\(|\bt\s*\(/.test(text)) continue
        if (!CN_TEXT.test(text) && !CN_CHAR.test(text)) continue
        // 跳过 import 路径等
        if (/^[./@]/.test(text) || /\.(vue|ts|js|json|css|scss)$/.test(text)) continue
        if (alreadyWrapped(scan, m.index)) continue

        // :placeholder="'请选择层级'" → 外层 "..." 会整段匹配成 "'请选择层级'"
        // 需要再剥一层引号，把真正的中文文案放进 bag
        const unwrapped = unwrapNestedQuotedChinese(text)
        if (unwrapped) {
            bag.add(unwrapped)
            continue
        }

        bag.add(text)
    }
}

/** "'中文'" / '"中文"' → 中文；否则 null */
function unwrapNestedQuotedChinese(text) {
    const m = text.match(/^(['"])([\s\S]*)\1$/)
    if (!m) return null
    const inner = normalizeText(m[2])
    if (!inner || isSkippableText(inner)) return null
    if (!CN_CHAR.test(inner)) return null
    if (/\$t\s*\(|\bi18n\.t\s*\(|\bt\s*\(/.test(inner)) return null
    return inner
}

function collectFromTemplateText(template, bag) {
    const scan = stripCommentsForScan(template, true)
    // 仅静态属性 title="中文"（跳过 :attr / v-bind / @）
    const attrRe = /(?<![.:@])\b([a-zA-Z][\w-]*)\s*=\s*(["'])([^"'<>]*[\u4e00-\u9fff][^"'<>]*)\2/g
    let m
    while ((m = attrRe.exec(scan))) {
        const text = normalizeText(m[3])
        if (isSkippableText(text)) continue
        if (/[?:]/.test(text) && /['"]/.test(text)) continue // 误伤表达式
        bag.add(text)
    }
    // 标签间文本（排除已是插值的）
    const textRe = />([^<>{]*[\u4e00-\u9fff][^<>{}]*)</g
    while ((m = textRe.exec(scan))) {
        const text = normalizeText(m[1])
        if (!isSkippableText(text)) bag.add(text)
    }
    // 绑定/表达式里的短中文引号串
    collectFromQuotedStrings(scan, bag)
}

function isLikelyExpressionKey(text) {
    return /[?:]=/.test(text) || /\?.*:/.test(text) || /\b(true|false|null)\b/.test(text)
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 与 normalizeText 对齐：源码里连续空白可能与 key 不一致，匹配时放宽 */
function escapeRegExpFlexibleWs(s) {
    return escapeRegExp(s).replace(/\s+/g, '\\s+')
}

function replaceInScript(code, texts, options = {}) {
    const { isScriptSetup = true } = options
    let next = code
    let changed = false
    let needUseI18n = false
    let needGlobalT = false
    const sorted = [...texts].sort((a, b) => b.length - a.length)

    for (const text of sorted) {
        const flexEsc = escapeRegExpFlexibleWs(text)
        for (const quote of ["'", '"', '`']) {
            const re = new RegExp(`${quote}${flexEsc}${quote}`, 'g')
            next = next.replace(re, (match, offset) => {
                if (alreadyWrapped(next, offset)) return match
                const lineStart = next.lastIndexOf('\n', offset) + 1
                const lineEnd = next.indexOf('\n', offset)
                const line = next.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
                if (/^\s*\/\//.test(line)) return match
                if (/\bimport\b/.test(line) || /\bfrom\b/.test(line)) return match
                // props default 等：保留中文 key，由模板 $t() 翻译
                const before = next.slice(Math.max(0, offset - 120), offset)
                if (/\bdefault\s*:\s*$/.test(before) || /\bdefault\s*:\s*\(\)\s*=>\s*$/.test(before)) {
                    return match
                }
                // 对象字面量 key：'中文': value → [t('中文')]: value
                // 排除三元 ? 'a' : 'b'（否则会误写成 [t('a')]）
                const after = next.slice(offset + match.length, offset + match.length + 20)
                const lineBefore = next.slice(lineStart, offset)
                const isObjectKeyColon =
                    /^\s*:/.test(after) &&
                    (lineBefore.match(/\?/g) || []).length <= (lineBefore.match(/:/g) || []).length
                if (isObjectKeyColon) {
                    changed = true
                    if (isScriptSetup) {
                        needUseI18n = true
                        return `[t('${text}')]`
                    }
                    needGlobalT = true
                    return `[t('${text}')]`
                }
                if (/^\s*\*/.test(line) || /@param|@returns|@example/.test(line)) return match
                if (/\bconsole\.(log|warn|error|info|debug)\b/.test(line)) return match
                changed = true
                if (isScriptSetup) {
                    needUseI18n = true
                    return `t('${text}')`
                }
                needGlobalT = true
                return `t('${text}')`
            })
        }
    }

    if (needUseI18n && isScriptSetup && !/\bconst\s*\{\s*t\s*\}\s*=\s*useI18n\s*\(/.test(next)) {
        let code = next.replace(/^\n*/, '')
        if (!/from\s+['"]vue-i18n['"]/.test(code)) {
            code = `import { useI18n } from 'vue-i18n'\n` + code
        }
        if (!/\bconst\s*\{\s*t\s*\}\s*=\s*useI18n\s*\(/.test(code)) {
            // 插在全部 import（含多行 import {..} from）之后
            const importBlockRe =
                /^(?:(?:import\s+type\s+|import\s+)[\s\S]*?from\s+['"][^'"]+['"]\s*\n)+/
            if (importBlockRe.test(code)) {
                code = code.replace(importBlockRe, (block) => `${block}\nconst { t } = useI18n()\n`)
            } else {
                code = `const { t } = useI18n()\n` + code
            }
        }
        next = '\n' + code.replace(/^\n+/, '')
        changed = true
    }

    if (needGlobalT && !isScriptSetup) {
        const from = tImportFrom()
        if (!next.includes(`from '${from}'`) && !next.includes(`from "${from}"`)) {
            if (/^import /m.test(next)) {
                next = next.replace(
                    /^(import[\s\S]*?\n)(?!import)/m,
                    (m) => `${m}import { t } from '${from}'\n`
                )
            } else {
                next = `import { t } from '${from}'\n` + next
            }
        }
        changed = true
    }

    return { code: next, changed }
}

function replaceInTemplate(template, texts) {
    let next = template
    let changed = false
    const sorted = [...texts]
        .filter((t) => !isLikelyExpressionKey(t))
        .sort((a, b) => b.length - a.length)

    for (const text of sorted) {
        const flexEsc = escapeRegExpFlexibleWs(text)

        // 静态属性 → 动态 :attr="$t('...')"（排除已是 : / v- / @）
        next = next.replace(
            new RegExp(`(?<![.:@])(\\s)([a-zA-Z][\\w-]*)\\s*=\\s*(["'])${flexEsc}\\3`, 'g'),
            (match, sp, attr, quote, offset) => {
                const head = next.slice(0, offset)
                if ((head.match(/<!--/g) || []).length > (head.match(/-->/g) || []).length) {
                    return match
                }
                changed = true
                return `${sp}:${attr}="$t('${text}')"`
            }
        )

        // :attr="'中文'" / :attr='"中文"' → :attr="$t('中文')"
        // （常见于已写成绑定、但值仍是中文字面量）
        for (const innerQ of ["'", '"']) {
            const lit = `${innerQ}${flexEsc}${innerQ}`
            next = next.replace(
                new RegExp(`(:[A-Za-z][\\w-]*\\s*=\\s*)"${lit}"`, 'g'),
                (match, head) => {
                    changed = true
                    return `${head}"$t('${text}')"`
                }
            )
            next = next.replace(
                new RegExp(`(:[A-Za-z][\\w-]*\\s*=\\s*)'${lit}'`, 'g'),
                (match, head) => {
                    changed = true
                    return `${head}'$t('${text}')'`
                }
            )
        }

        // 表达式里的 '中文' / "中文" → $t('中文')
        for (const q of ["'", '"']) {
            const re = new RegExp(`${q}${flexEsc}${q}`, 'g')
            next = next.replace(re, (match, offset) => {
                if (alreadyWrapped(next, offset)) return match
                const head = next.slice(0, offset)
                if ((head.match(/<!--/g) || []).length > (head.match(/-->/g) || []).length) {
                    return match
                }
                // 仅在绑定表达式上下文替换（:attr=" ... " 或 {{ }}）
                const before = next.slice(Math.max(0, offset - 80), offset)
                const inBinding =
                    /:[A-Za-z][\w-]*\s*=\s*"([^"]|\\.)*$/.test(before) ||
                    /:[A-Za-z][\w-]*\s*=\s*'([^']|\\.)*$/.test(before) ||
                    /\{\{[\s\S]*$/.test(before)
                if (!inBinding) return match
                changed = true
                return `$t('${text}')`
            })
        }

        // 标签间纯文本（源码空白可能与 normalize 后的 key 不一致）
        next = next.replace(new RegExp(`>(\\s*)${flexEsc}(\\s*)<`, 'g'), (match, a, b) => {
            changed = true
            return `>${a}{{ $t('${text}') }}${b}<`
        })
    }

    return { code: next, changed }
}

function processVueFile(filePath, allTexts, opts) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { descriptor, errors } = parseSFC(raw, { filename: filePath })
    if (errors?.length) {
        console.warn(`[warn] parse failed: ${filePath}`, errors[0]?.message)
    }

    const fileTexts = new Set()
    if (descriptor.template?.content) {
        collectFromTemplateText(descriptor.template.content, fileTexts)
    }
    for (const block of [descriptor.scriptSetup, descriptor.script].filter(Boolean)) {
        collectFromQuotedStrings(block.content, fileTexts)
    }

    fileTexts.forEach((t) => allTexts.add(t))

    if (!opts.write || !opts.replace || fileTexts.size === 0) {
        return { changed: false, texts: [...fileTexts] }
    }

    let current = raw
    let changed = false

    if (descriptor.template) {
        const tpl = descriptor.template
        const { code, changed: c } = replaceInTemplate(tpl.content, fileTexts)
        if (c) {
            current =
                current.slice(0, tpl.loc.start.offset) + code + current.slice(tpl.loc.end.offset)
            changed = true
        }
    }

    const parsed = parseSFC(current, { filename: filePath })
    const blocks = [parsed.descriptor.scriptSetup, parsed.descriptor.script].filter(Boolean)
    blocks.sort((a, b) => b.loc.start.offset - a.loc.start.offset)

    for (const block of blocks) {
        const isScriptSetup = block === parsed.descriptor.scriptSetup
        const { code, changed: c } = replaceInScript(block.content, fileTexts, { isScriptSetup })
        if (c) {
            current =
                current.slice(0, block.loc.start.offset) +
                code +
                current.slice(block.loc.end.offset)
            changed = true
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, current, 'utf8')
    }

    return { changed, texts: [...fileTexts] }
}

function processScriptFile(filePath, allTexts, opts) {
    const raw = fs.readFileSync(filePath, 'utf8')
    const fileTexts = new Set()
    collectFromQuotedStrings(raw, fileTexts)
    fileTexts.forEach((t) => allTexts.add(t))

    if (!opts.write || !opts.replace || fileTexts.size === 0) {
        return { changed: false, texts: [...fileTexts] }
    }

    // utils 等非组件：用全局 t，不注入 useI18n
    let next = raw
    let changed = false
    const sorted = [...fileTexts].sort((a, b) => b.length - a.length)

    for (const text of sorted) {
        const flexEsc = escapeRegExpFlexibleWs(text)
        for (const quote of [`'`, `"`]) {
            const re = new RegExp(`${quote}${flexEsc}${quote}`, 'g')
            next = next.replace(re, (match, offset) => {
                if (alreadyWrapped(next, offset)) return match
                const lineStart = next.lastIndexOf('\n', offset) + 1
                const line = next.slice(lineStart, next.indexOf('\n', offset))
                if (/^\s*\/\//.test(line)) return match
                if (/from\s+['"]/.test(line) || /import\s+/.test(line)) return match
                changed = true
                return `t('${text}')`
            })
        }
    }

    if (changed) {
        const from = tImportFrom()
        if (!next.includes(`from '${from}'`) && !next.includes(`from "${from}"`)) {
            if (/^import /m.test(next)) {
                next = next.replace(
                    /^(import[\s\S]*?\n)(?!import)/m,
                    (m) => `${m}import { t } from '${from}'\n`
                )
            } else {
                next = `import { t } from '${from}'\n` + next
            }
        }
        fs.writeFileSync(filePath, next, 'utf8')
    }

    return { changed, texts: [...fileTexts] }
}

export function runExtract(argv = []) {
    const { root, localesDir, sourceLocale } = getContext()
    const opts = parseArgs(argv)
    const pathLabel = opts.scanPaths
        .map((p) => path.relative(root, p).replace(/\\/g, '/'))
        .join(', ')
    console.log(
        `[i18n:extract] mode=${opts.write ? 'WRITE' : 'DRY-RUN'} replace=${opts.replace} path=${pathLabel}`
    )

    const localesRel = path.relative(root, localesDir).replace(/\\/g, '/')
    const fileSet = new Set()
    for (const scanPath of opts.scanPaths) {
        for (const f of walk(scanPath)) fileSet.add(f)
    }
    const files = [...fileSet]
    const allTexts = new Set()
    const fileReports = []

    for (const file of files) {
        const rel = path.relative(root, file).replace(/\\/g, '/')
        if (localesRel && (rel === localesRel || rel.startsWith(localesRel + '/'))) continue
        if (rel.includes('scripts/')) continue

        let result
        if (file.endsWith('.vue')) {
            result = processVueFile(file, allTexts, opts)
        } else {
            result = processScriptFile(file, allTexts, opts)
        }
        if (result.texts.length) {
            fileReports.push({
                file: rel,
                count: result.texts.length,
                changed: result.changed,
                texts: result.texts,
                samples: result.texts.slice(0, 20)
            })
        }
    }

    const zh = loadLocale(sourceLocale)
    const added = []
    for (const text of allTexts) {
        if (isMetaKey(text)) continue
        if (!(text in zh)) {
            zh[text] = text
            added.push(text)
        } else if (!zh[text]) {
            zh[text] = text
        }
    }

    if (opts.write) {
        saveLocale(sourceLocale, zh)
        for (const code of LOCALE_CODES) {
            if (code === sourceLocale) continue
            const pack = loadLocale(code)
            for (const text of Object.keys(zh)) {
                if (isMetaKey(text)) continue
                if (!(text in pack) || pack[text] == null || pack[text] === '') {
                    pack[text] = zh[text]
                }
            }
            saveLocale(code, pack)
        }
    }

    const texts = [...allTexts].filter((t) => !isMetaKey(t))
    const report = {
        mode: opts.write ? 'write' : 'dry-run',
        scanPath: pathLabel,
        filesScanned: files.length,
        filesWithChinese: fileReports.length,
        uniqueTexts: texts.length,
        newKeys: added.length,
        texts,
        added,
        addedSample: added.slice(0, 50),
        files: fileReports.map((f) => ({
            ...f,
            texts: f.texts || f.samples
        }))
    }

    fs.mkdirSync(path.dirname(opts.report), { recursive: true })
    fs.writeFileSync(opts.report, JSON.stringify(report, null, 2), 'utf8')

    console.log(`[i18n:extract] scanned files: ${files.length}`)
    console.log(`[i18n:extract] files with CN: ${fileReports.length}`)
    console.log(`[i18n:extract] files rewritten: ${fileReports.filter((f) => f.changed).length}`)
    console.log(`[i18n:extract] unique texts: ${allTexts.size}`)
    console.log(`[i18n:extract] new keys: ${added.length}`)
    console.log(`[i18n:extract] report: ${path.relative(root, opts.report)}`)
    if (opts.write) {
        for (const f of fileReports.filter((x) => x.changed)) {
            console.log(`  ✓ ${f.file} (${f.count} texts)`)
        }
    }
    if (!opts.write) {
        console.log(`[i18n:extract] dry-run only. Add --write to apply locale + source updates.`)
    }
    return report
}
