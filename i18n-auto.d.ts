/** Augment Vite UserConfig with i18nAuto (optional helper for consumers). */

export interface I18nAutoConfig {
    /** Directories/files to scan (relative to project root). Default: ['src'] */
    include?: string[]
    /** Directory names to skip while walking. */
    exclude?: string[]
    /** Locale JSON directory. Default: 'src/locales' */
    localesDir?: string
    /** Source language code. Default: 'zh-CN' */
    sourceLocale?: string
    /** Target locale codes (en-US, de-DE, ...). */
    targetLocales?: string[]
    /** Replace Chinese with $t()/t(). Default: true */
    replace?: boolean
    /** Run online translation after extract. Default: true */
    translate?: boolean
    /** Report output directory. Default: 'reports' */
    reportsDir?: string
    /** Import path when injecting `t` into plain .ts/.js. Default: '@/locales' */
    tImportFrom?: string
}

declare module 'vite' {
    interface UserConfig {
        i18nAuto?: I18nAutoConfig
    }
}

export {}
