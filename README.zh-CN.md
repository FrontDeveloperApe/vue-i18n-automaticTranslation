# vue-i18n-automatic-translation

[English](./README.md)

扫描 Vue / TS / JS 源码中的中文文案，自动包成 `$t()` / `t()`，写入语言包 JSON，并在线翻译。通过 `vite.config` 的 `i18nAuto` 配置扫描目录。

## 安装

```bash
npm i -D vue-i18n-automatic-translation
# peer：vite（用于加载 vite.config.ts）
npm i -D vite
```

或从本地路径 / git 安装：

```bash
npm i -D ../vue-i18n-automaticTranslation
# npm i -D git+https://github.com/your-org/vue-i18n-automaticTranslation.git
```

## 配置（`vite.config.ts`）

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  // ...原有 vite 配置
  i18nAuto: {
    include: ['src/views', 'src/components'], // 要扫描的目录
    exclude: ['locales', 'assets', 'styles', 'node_modules', 'dist'],// 额外忽略目录
    localesDir: 'src/locales', //语言包生成地址
    sourceLocale: 'zh-CN', //源语言
    targetLocales: ['en-US', 'de-DE', 'ja-JP', 'ko-KR'], //目标语言
    replace: true,      // 是否把源码中文替换成 $t()/t()
    translate: true,    // 抽取后是否在线翻译
    reportsDir: 'reports', //日志
    tImportFrom: '@/locales' // 普通 .ts/.js 注入 t 时的 import 路径
  }
})
```

未配置 `i18nAuto` 时：默认扫描 `src`，语言列表与内置默认集一致。

### 配置字段

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `include` | `['src']` | 要扫描的路径 |
| `exclude` | `locales`、`assets`、`styles` 等 | 遍历时跳过的目录名 |
| `localesDir` | `'src/locales'` | 语言包目录 |
| `sourceLocale` | `'zh-CN'` | 源语言 |
| `targetLocales` | 内置语言集 | 目标语言 |
| `replace` | `true` | 是否替换为 `$t()` / `t()` |
| `translate` | `true` | 抽取后是否在线翻译 |
| `reportsDir` | `'reports'` | 报告输出目录 |
| `tImportFrom` | `'@/locales'` | 普通 `.ts` / `.js` 注入 `t` 的导入路径 |

## 命令

在消费方项目根目录执行（有 `vite.config` / `package.json` 的目录）：

```bash
# 按 include（或指定 path）扫描中文 → 写语言包 → 包 $t → 同步 → 翻译
npx i18n-auto scan
npx i18n-auto scan src/views/workbench
npx i18n-auto scan --dry
npx i18n-auto scan --no-translate

# 只处理 git 变更的源码文件（且落在 include 内）
npx i18n-auto changed
npx i18n-auto changed --staged
npx i18n-auto changed --no-translate
npx i18n-auto changed --fill-all

# 辅助命令
npx i18n-auto sync
npx i18n-auto inject-meta
npx i18n-auto fill-en --auto
npx i18n-auto fill-locales --check
npx i18n-auto offline-en
```

### package.json scripts（可选）

```json
{
  "scripts": {
    "i18n:scan": "i18n-auto scan",
    "i18n:changed": "i18n-auto changed"
  }
}
```

## 行为说明

- 注释（`<!-- -->` / `//` / `/* */`）中的中文不会被替换。
- 已有非中文译文不会被覆盖。
- 在线翻译使用有道 demo + MyMemory（英文另有 Google 兜底）。免费配额可能限流，可重复执行续跑。
- 报告写入 `reports/`（如 `i18n-extract.json`、`i18n-changed-keys.json` 等）。

## 发布

```bash
cd vue-i18n-automaticTranslation
npm login
npm publish
```

或把本目录推成独立 git 仓库，通过 `git+https://...` 安装。

## License

MIT
