# vue-i18n-automatic-translation

[中文文档](./README.zh-CN.md)

Scan Chinese copy in Vue / TS / JS source, wrap with `$t()` / `t()`, write locale JSON packs, and auto-translate. Configure scan paths via `vite.config` `i18nAuto`.

## Install

```bash
npm i -D vue-i18n-automatic-translation
# peer: vite (used to load vite.config.ts)
npm i -D vite
```

Or from a local path / git:

```bash
npm i -D ../vue-i18n-automaticTranslation
# npm i -D git+https://github.com/your-org/vue-i18n-automaticTranslation.git
```

## Configure (`vite.config.ts`)

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  // ...your existing vite options
  i18nAuto: {
    include: ['src/views', 'src/components'], // directories to scan
    exclude: ['locales', 'assets', 'styles', 'node_modules', 'dist'],
    localesDir: 'src/locales',
    sourceLocale: 'zh-CN',
    targetLocales: ['en-US', 'de-DE', 'ja-JP', 'ko-KR'],
    replace: true,      // wrap source with $t()/t()
    translate: true,    // online translate after extract
    reportsDir: 'reports',
    tImportFrom: '@/locales' // import path for plain .ts/.js `t`
  }
})
```

If `i18nAuto` is omitted, defaults scan `src` and use the built-in locale set (same as the original tenant toolkit).

### Config fields

| Field | Default | Description |
|-------|---------|-------------|
| `include` | `['src']` | Paths to scan |
| `exclude` | `locales`, `assets`, `styles`, … | Directory names to skip |
| `localesDir` | `'src/locales'` | Locale JSON directory |
| `sourceLocale` | `'zh-CN'` | Source language |
| `targetLocales` | built-in set | Target languages |
| `replace` | `true` | Replace Chinese with `$t()` / `t()` |
| `translate` | `true` | Online translate after extract |
| `reportsDir` | `'reports'` | Report output directory |
| `tImportFrom` | `'@/locales'` | Import path when injecting `t` into plain `.ts` / `.js` |

## Commands

Run inside the consumer project (directory with `vite.config` / `package.json`):

```bash
# Scan include paths (or pass a path), extract Chinese, wrap $t, sync, translate
npx i18n-auto scan
npx i18n-auto scan src/views/workbench
npx i18n-auto scan --dry
npx i18n-auto scan --no-translate

# Only git-changed source files under include
npx i18n-auto changed
npx i18n-auto changed --staged
npx i18n-auto changed --no-translate
npx i18n-auto changed --fill-all

# Helpers
npx i18n-auto sync
npx i18n-auto inject-meta
npx i18n-auto fill-en --auto
npx i18n-auto fill-locales --check
npx i18n-auto offline-en
```

### package.json scripts (optional)

```json
{
  "scripts": {
    "i18n:scan": "i18n-auto scan",
    "i18n:changed": "i18n-auto changed"
  }
}
```

## Behavior notes

- Comments (`<!-- -->` / `//` / `/* */`) are not replaced.
- Existing non-Chinese translations are never overwritten.
- Online translation uses Youdao demo + MyMemory (+ Google for English fallback). Free quotas may throttle; re-run to resume.
- Reports are written under `reports/` (`i18n-extract.json`, `i18n-changed-keys.json`, …).

## Publish

```bash
cd vue-i18n-automaticTranslation
npm login
npm publish
```

Or push this folder as its own git repo and install via `git+https://...`.

## License

MIT
