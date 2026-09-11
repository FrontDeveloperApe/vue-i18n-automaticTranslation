/**
 * CLI entry: i18n-auto <scan|changed|sync|inject-meta|fill-locales|fill-en> [...]
 */

import { loadProjectConfig } from './config.mjs'
import { createContextFromConfig, setContext } from './context.mjs'
import { runScan } from './scan.mjs'
import { runChanged } from './changed.mjs'
import { runSync } from './sync.mjs'
import { runInjectMeta } from './inject-meta.mjs'
import { runTranslateLocales } from './translate-locales.mjs'
import { runTranslateEn } from './translate-en.mjs'
import { runOfflineEn } from './offline-en.mjs'

function printHelp() {
    console.log(`vue-i18n-automatic-translation

Usage:
  i18n-auto scan [path] [options]
  i18n-auto changed [options]
  i18n-auto sync [--fill=empty]
  i18n-auto inject-meta
  i18n-auto fill-locales [--check] [--all] [--keys-file=...]
  i18n-auto fill-en [--check] [--auto] [--keys-file=...]
  i18n-auto offline-en [--check]

Configure in vite.config.ts:

  export default defineConfig({
    i18nAuto: {
      include: ['src/views', 'src/components'],
      localesDir: 'src/locales',
      sourceLocale: 'zh-CN',
      targetLocales: ['en-US', 'de-DE', 'ja-JP'],
    }
  })

scan options:
  --dry            scan only, do not write
  --no-replace     write locales but do not wrap source with $t()/t()
  --no-translate   skip online translation

changed options:
  --dry --staged --no-translate --fill-all --online-en
`)
}

export async function runCli(argv) {
    const cmd = argv[0]
    if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
        printHelp()
        return
    }

    const { root, configPath, i18nAuto } = await loadProjectConfig(process.cwd())
    const ctx = createContextFromConfig(i18nAuto)
    setContext(ctx)

    console.log(`[i18n-auto] root=${root}`)
    if (configPath) console.log(`[i18n-auto] config=${configPath}`)
    console.log(`[i18n-auto] include=${ctx.include.join(', ')}`)
    console.log(`[i18n-auto] localesDir=${ctx.localesDir}`)

    const rest = argv.slice(1)

    switch (cmd) {
        case 'scan':
            await runScan(rest)
            break
        case 'changed':
            await runChanged(rest)
            break
        case 'sync':
            runSync(rest)
            break
        case 'inject-meta':
            runInjectMeta()
            break
        case 'fill-locales':
            await runTranslateLocales(rest)
            break
        case 'fill-en':
            await runTranslateEn(rest)
            break
        case 'offline-en':
            runOfflineEn(rest)
            break
        default:
            console.error(`[i18n-auto] unknown command: ${cmd}`)
            printHelp()
            process.exit(1)
    }
}
