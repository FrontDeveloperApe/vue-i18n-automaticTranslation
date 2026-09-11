/** Built-in locale metadata (same set as tenant by default). */

export const DEFAULT_LOCALE_META = {
    'zh-CN': { file: 'zh-CN.json', code: 'zh-CN', name: '简体中文', nameZh: '简体中文' },
    'en-US': { file: 'en-US.json', code: 'en-US', name: 'English', nameZh: '英语' },
    'de-DE': { file: 'de-DE.json', code: 'de-DE', name: 'Deutsch', nameZh: '德语' },
    'ru-RU': { file: 'ru-RU.json', code: 'ru-RU', name: 'Русский', nameZh: '俄语' },
    'hi-IN': { file: 'hi-IN.json', code: 'hi-IN', name: 'हिन्दी', nameZh: '印地语' },
    'es-ES': { file: 'es-ES.json', code: 'es-ES', name: 'Español', nameZh: '西班牙语' },
    'ar-SA': { file: 'ar-SA.json', code: 'ar-SA', name: 'العربية', nameZh: '阿拉伯语' },
    'fr-FR': { file: 'fr-FR.json', code: 'fr-FR', name: 'Français', nameZh: '法语' },
    'bn-BD': { file: 'bn-BD.json', code: 'bn-BD', name: 'বাংলা', nameZh: '孟加拉语' },
    'pt-BR': { file: 'pt-BR.json', code: 'pt-BR', name: 'Português', nameZh: '葡萄牙语' },
    'id-ID': { file: 'id-ID.json', code: 'id-ID', name: 'Indonesia', nameZh: '印尼语' },
    'ja-JP': { file: 'ja-JP.json', code: 'ja-JP', name: '日本語', nameZh: '日语' },
    'ko-KR': { file: 'ko-KR.json', code: 'ko-KR', name: '한국어', nameZh: '韩语' }
}

export const DEFAULT_TARGET_LOCALES = Object.keys(DEFAULT_LOCALE_META).filter((c) => c !== 'zh-CN')

export const DEFAULT_I18N_AUTO = {
    include: ['src'],
    exclude: ['locales', 'assets', 'styles', 'node_modules', 'dist', '.git'],
    localesDir: 'src/locales',
    sourceLocale: 'zh-CN',
    targetLocales: DEFAULT_TARGET_LOCALES,
    replace: true,
    translate: true,
    reportsDir: 'reports',
    /** Import path used when injecting `t` into plain .ts/.js files */
    tImportFrom: '@/locales'
}
