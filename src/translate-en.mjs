/**
 * 安全补全 en-US：只翻译「仍是中文占位」的条目，绝不覆盖已有英文。
 *
 * Usage:
 *   node scripts/i18n-translate-en.mjs --check              # 只检查，不写文件
 *   node scripts/i18n-translate-en.mjs --auto               # 词典 + 在线翻译未译项
 *   node scripts/i18n-translate-en.mjs --auto --limit=50    # 先试 50 条
 *   node scripts/i18n-translate-en.mjs --force --auto       # 强制用词典覆盖（慎用）
 *
 * 推荐：
 *   npm run i18n:fill-en:check
 *   npm run i18n:fill-en
 *
 * 词典来源（按优先级）：
 *   1. 本文件 DICT
 *   2. scripts/i18n-en-*.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadLocale as load, saveLocale as save, isMetaKey } from './locale-io.mjs'
import { getContext } from './context.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTRA_DICT_FILE = path.join(__dirname, 'dict/i18n-en-extra.json')
const DICT_DIR = path.join(__dirname, 'dict')

function parseTranslateEnArgs(argv) {
    return {
        force: argv.includes('--force'),
        auto: argv.includes('--auto'),
        checkOnly: argv.includes('--check'),
        autoLimit: (() => {
            const a = argv.find((x) => x.startsWith('--limit='))
            return a ? Number(a.split('=')[1]) : Infinity
        })(),
        delayMs: (() => {
            const a = argv.find((x) => x.startsWith('--delay='))
            return a ? Number(a.split('=')[1]) : 200
        })(),
        keysFile: (() => {
            const a = argv.find((x) => x.startsWith('--keys-file='))
            return a ? a.slice('--keys-file='.length) : null
        })()
    }
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

const DICT = {
    '`车道${n}车辙下陷差值(mm)`': 'Lane ${n} rut depression difference (mm)',
    '`选择${tipsText}`': 'Select ${tipsText}',
    '1. 小程序APPID和小程序路径链接地址，小程序路径链接地址请填写小程序的页面路径，如：pages/index/index':
        '1. Mini Program APPID and page path. Use a page path such as: pages/index/index',
    '百度地图 SDK 加载出错': 'Baidu Map SDK load error',
    '百度地图 SDK 加载失败': 'Baidu Map SDK failed to load',
    '本地上传': 'Local upload',
    '本地图标': 'Local icons',
    '编辑后是否立即更新地图': 'Update map immediately after editing',
    '标记数据不足': 'Insufficient marker data',
    '表格列配置不能为空，请检查表格是否正确渲染':
        'Table column config is empty. Please check whether the table rendered correctly',
    '表格没有可导出的列': 'No exportable columns in the table',
    '表格引用未初始化，请等待表格加载完成后再试':
        'Table ref is not ready. Please wait until the table finishes loading',
    '播放': 'Play',
    '菜单栏宽度': 'Sidebar width',
    '操作': 'Actions',
    '查看': 'View',
    '车道1车辙线1': 'Lane 1 rut line 1',
    '车道1车辙线2': 'Lane 1 rut line 2',
    '车道2车辙线1': 'Lane 2 rut line 1',
    '车道2车辙线2': 'Lane 2 rut line 2',
    '车道3车辙线1': 'Lane 3 rut line 1',
    '车道3车辙线2': 'Lane 3 rut line 2',
    '车道4车辙线1': 'Lane 4 rut line 1',
    '车道4车辙线2': 'Lane 4 rut line 2',
    '车道数': 'Number of lanes',
    '车辆绘制完成': 'Vehicle drawing completed',
    '车辆列表必须是数组': 'Vehicle list must be an array',
    '车辆数据不完整:': 'Incomplete vehicle data:',
    '车辙线（可选）': 'Rut lines (optional)',
    '尺底距地面最大间隙(mm):': 'Max gap from ruler bottom to ground (mm):',
    '处理车辆数据时出错:': 'Error while processing vehicle data:',
    '传递参数': 'Pass parameters',
    '创建时间': 'Created at',
    '当页全选': 'Select all on page',
    '导出': 'Export',
    '导出范围：': 'Export range:',
    '导出设置': 'Export settings',
    '导出失败，请重试': 'Export failed, please retry',
    '导出失败:': 'Export failed:',
    '导出数据': 'Export data',
    '导出为 CSV 文件': 'Export as CSV',
    '导出为 Excel 文件': 'Export as Excel',
    '导出文件名称：': 'Export file name:',
    '导出限制：': 'Export limit:',
    '道路边桩线': 'Road edge stake line',
    '道路设计数据模板(用于提取道路纵坡和横坡数据)':
        'Road design data template (for extracting longitudinal and cross slope)',
    '道路中桩线': 'Road center stake line',
    '地址': 'Address',
    '地址复制成功': 'Address copied',
    '点1': 'Point 1',
    '点2': 'Point 2',
    '点3': 'Point 3',
    '对于人字坡必须添加三条线': 'Herringbone slope requires three lines',
    '非人字坡路': 'Non-herringbone slope road',
    '分页导出': 'Paged export',
    '分页范围：': 'Page range:',
    '风格设置': 'Style',
    '服务协议': 'Terms of service',
    '高程差(cm)': 'Elevation difference (cm)',
    '个人设置': 'Profile',
    '个人中心': 'Personal center',
    '个人资料': 'Profile info',
    '更新车辆位置时出错:': 'Error updating vehicle position:',
    '更新地图和数据': 'Update map and data',
    '工业项目生产可视化仪表屏': 'Industrial production visualization dashboard',
    '关闭当前': 'Close current',
    '关闭其他': 'Close others',
    '关闭全部': 'Close all',
    '关联磅房': 'Linked weighbridge',
    '关于我们': 'About us',
    '轨道数据检查平整度': 'Track data roughness check',
    '横坡抽稀距离比例': 'Cross-slope thinning distance ratio',
    '横坡拟合检查数量': 'Cross-slope fit check count',
    '横坡拟合平均值数量': 'Cross-slope fit average count',
    '后台上传': 'Backend upload',
    '绘制标记': 'Draw marker',
    '绘制车辆时出错:': 'Error drawing vehicle:',
    '绘制过程中出错:': 'Error during drawing:',
    '绘制区域': 'Draw area',
    '绘制区域，点数:': 'Draw area, points:',
    '绘制图片': 'Draw image',
    '绘制文本': 'Draw text',
    '绘制文本:': 'Draw text:',
    '绘制线段列表': 'Draw polyline list',
    '绘制线段列表，点数:': 'Draw polyline list, points:',
    '绘制形状时出错:': 'Error drawing shape:',
    '绘制圆形': 'Draw circle',
    '绘制圆形，半径:': 'Draw circle, radius:',
    '基础页面': 'Basic pages',
    '基准路径搜索距离(m)': 'Base path search distance (m)',
    '基准路径右距离(m)': 'Base path right distance (m)',
    '基准路径左距离(m)': 'Base path left distance (m)',
    '加载': 'Load',
    '加载百度地图或初始化地图时出错:': 'Error loading or initializing Baidu Map:',
    '加载路面线设计数据': 'Load pavement line design data',
    '加载路面线原始数据': 'Load pavement line raw data',
    '间接调整横坡': 'Indirectly adjust cross slope',
    '检测点间隔(cm):': 'Checkpoint interval (cm):',
    '检测点总数': 'Total checkpoints',
    '检测计算': 'Run detection',
    '检测线编号': 'Detection line No.',
    '检测线横向间隔(m):': 'Detection line lateral interval (m):',
    '结束时间': 'End time',
    '结束桩号:': 'End station:',
    '经纬度': 'Coordinates',
    '均值处理高程差限值(cm)': 'Mean-filter elevation limit (cm)',
    '均值处理距离限值(m)': 'Mean-filter distance limit (m)',
    '开发版': 'Develop',
    '开启多页签栏': 'Enable multi-tabs',
    '开启黑暗模式': 'Enable dark mode',
    '开始绘制车辆:': 'Start drawing vehicle:',
    '开始绘制形状:': 'Start drawing shape:',
    '开始时间': 'Start time',
    '可选': 'Optional',
    '可以播放': 'Can play',
    '库存(t)': 'Stock (t)',
    '联系客服': 'Contact support',
    '链接选择': 'Select link',
    '两车道': 'Two lanes',
    '列表视图': 'List view',
    '录入时间': 'Entry time',
    '没有数据可导出': 'No data to export',
    '名称': 'Name',
    '命名分组': 'Name group',
    '模拟直尺长度(m):': 'Simulated ruler length (m):',
    '平滑后高程': 'Elevation after smoothing',
    '平滑后横坡(%)': 'Cross slope after smoothing (%)',
    '平滑后纵坡(%)': 'Longitudinal slope after smoothing (%)',
    '平滑后Z坐标': 'Z after smoothing',
    '平滑路径上下移动步长(mm)': 'Smooth path vertical step (mm)',
    '平滑前高程异常点实施局部均值化处理':
        'Apply local mean filter to elevation outliers before smoothing',
    '平滑前横坡(%)': 'Cross slope before smoothing (%)',
    '平滑前纵坡(%)': 'Longitudinal slope before smoothing (%)',
    '平滑前Z坐标': 'Z before smoothing',
    '平滑数据通用设置': 'General smoothing settings',
    '平铺视图': 'Tile view',
    '平整度检测计算完成': 'Roughness detection completed',
    '其他': 'Other',
    '启用插值点模式处理': 'Enable interpolation-point mode',
    '启用平滑处理': 'Enable smoothing',
    '起始桩号:': 'Start station:',
    '前端上传': 'Frontend upload',
    '清除缓存': 'Clear cache',
    '清空': 'Clear',
    '请设置起始桩号、结束桩号和统一横坡值':
        'Please set start station, end station and unified cross slope',
    '请输入': 'Please enter',
    '请输入导出文件名称': 'Please enter export file name',
    '请输入结束页码': 'Please enter end page',
    '请输入链接地址': 'Please enter URL',
    '请输入名称': 'Please enter name',
    '请输入起始页码': 'Please enter start page',
    '请输入小程序路径链接地址': 'Please enter mini program page path',
    '请输入小程序跳转参数(选填)': 'Please enter mini program params (optional)',
    '请输入小程序appId': 'Please enter mini program appId',
    '请提供表格引用或列配置': 'Please provide table ref or column config',
    '请填写完整的带有“https://”或“http://”的链接地址，链接的域名必须在微信公众平台设置业务域名':
        'Enter a full URL with https:// or http://. The domain must be configured as a business domain in WeChat MP admin',
    '请先完成平滑计算': 'Please finish smoothing calculation first',
    '请选择': 'Please select',
    '请选择链接': 'Please select a link',
    '请选择图标': 'Please select an icon',
    '请选择文件来源': 'Please select file source',
    '请选择CSV文件': 'Please select a CSV file',
    '区域数据不足': 'Insufficient area data',
    '取消': 'Cancel',
    '全部': 'All',
    '全部导出': 'Export all',
    '全屏模式': 'Fullscreen',
    '确定': 'OK',
    '确定退出登录吗？': 'Are you sure you want to log out?',
    '确定要删除？': 'Are you sure you want to delete?',
    '确认导出': 'Confirm export',
    '确认删除后，本地或云存储文件也将同步删除，如文件已被使用，请谨慎操作！':
        'After confirmation, local/cloud files will also be deleted. Be careful if the file is in use!',
    '人字坡边线1': 'Herringbone edge line 1',
    '人字坡边线2': 'Herringbone edge line 2',
    '人字坡路': 'Herringbone slope road',
    '人字坡路必须加载三条线': 'Herringbone slope road requires three lines',
    '人字坡中线': 'Herringbone center line',
    '日报自动生成': 'Auto daily report',
    '三车道': 'Three lanes',
    '删除': 'Delete',
    '删除分组': 'Delete group',
    '删除文件夹将会永久删除文件夹及其所有内容。您确定要继续吗？':
        'Deleting this folder will permanently remove it and all contents. Continue?',
    '商城首页': 'Mall home',
    '商城页面': 'Mall pages',
    '上传进度': 'Upload progress',
    '上传时间': 'Uploaded at',
    '上级类别': 'Parent category',
    '设置': 'Settings',
    '时间更新': 'Time updated',
    '示例：id=2&ustm=jiny&name=234': 'Example: id=2&ustm=jiny&name=234',
    '视频': 'Video',
    '视频预览': 'Video preview',
    '收起菜单': 'Collapse menu',
    '数据量：': 'Data volume:',
    '刷新': 'Refresh',
    '四车道': 'Four lanes',
    '搜索': 'Search',
    '搜索图标': 'Search icons',
    '摊铺标高容差(mm)': 'Paving elevation tolerance (mm)',
    '摊铺达标容差': 'Paving pass tolerance',
    '摊铺厚度容差(mm)': 'Paving thickness tolerance (mm)',
    '体验版': 'Trial',
    '添加': 'Add',
    '添加底部形状:': 'Add bottom shape:',
    '添加顶部形状:': 'Add top shape:',
    '添加分组': 'Add group',
    '跳转小程序': 'Open mini program',
    '统一横坡值(%):': 'Unified cross slope (%):',
    '图片': 'Image',
    '图片数据不足': 'Insufficient image data',
    '退出登录': 'Log out',
    '退出全屏': 'Exit fullscreen',
    '未分组': 'Ungrouped',
    '未知的形状类型:': 'Unknown shape type:',
    '温馨提示': 'Tips',
    '文本数据不足': 'Insufficient text data',
    '文章名称': 'Article title',
    '文章资讯': 'Articles',
    '我的钱包': 'My wallet',
    '我的收藏': 'My favorites',
    '无': 'None',
    '无法获取 canvas 上下文': 'Unable to get canvas context',
    '无法转换车辆坐标': 'Unable to convert vehicle coordinates',
    '无法转换GPS坐标': 'Unable to convert GPS coordinates',
    '系统提示': 'System notice',
    '下载': 'Download',
    '显示面包屑': 'Show breadcrumb',
    '显示LOGO': 'Show logo',
    '线段列表数据不足': 'Insufficient polyline data',
    '线平整度修正-尺到地面最大空隙(mm)':
        'Line roughness correction - max ruler-to-ground gap (mm)',
    '线平整度修正-模拟直尺长度(m)': 'Line roughness correction - simulated ruler length (m)',
    '小程序版本': 'Mini program version',
    '小程序管理后台 -&gt; 设置 -&gt; 隐私与安全 -&gt; 明文 scheme 拉起此小程序 （点击跳转去配置）':
        'MP Admin -> Settings -> Privacy & Security -> Plain scheme launch (click to configure)',
    '小程序路径': 'Mini program path',
    '小程序跳转': 'Mini program jump',
    '小程序APPID': 'Mini program APPID',
    '小计': 'Subtotal',
    '形状绘制完成': 'Shape drawing completed',
    '形状类型:': 'Shape type:',
    '形状数据:': 'Shape data:',
    '形状数据不完整:': 'Incomplete shape data:',
    '修改': 'Edit',
    '修改时间': 'Modified at',
    '选择': 'Select',
    '压实标高容差(mm)': 'Compaction elevation tolerance (mm)',
    '压实厚度容差(mm)': 'Compaction thickness tolerance (mm)',
    '沿路径距离': 'Distance along path',
    '页，至': 'page to',
    '页码必须大于0': 'Page number must be greater than 0',
    '页码必须是整数': 'Page number must be an integer',
    '移动': 'Move',
    '移动到指定位置时出错:': 'Error moving to position:',
    '移动文件': 'Move file',
    '移动文件至': 'Move file to',
    '已达到选择上限': 'Selection limit reached',
    '异常点间隙值': 'Outlier gap value',
    '异常点序号': 'Outlier index',
    '异常点总数': 'Total outliers',
    '隐私政策': 'Privacy policy',
    '应用工具': 'App tools',
    '盈亏': 'P&L',
    '圆形数据不足': 'Insufficient circle data',
    '在平滑计算结果上实施3m直尺法检测：沿道路线横向固定间隔生成检测线，在检测线上按固定间隔模拟3m直尺检测':
        'Run 3m straightedge detection on smoothed result: generate lateral detection lines at fixed intervals and simulate 3m ruler checks',
    '暂停': 'Pause',
    '暂无数据~': 'No data yet',
    '展开菜单': 'Expand menu',
    '正式版': 'Release',
    '正在导出数据...': 'Exporting data...',
    '正在导出中...': 'Exporting...',
    '正在获取数据...': 'Fetching data...',
    '只展开一个一级菜单': 'Accordion menu',
    '至少加载两条车道分界线': 'Load at least two lane boundary lines',
    '至少加载两条车道分界线；该处加载的道路线可以不是严格的车道分界线':
        'Load at least two lane boundary lines; they do not have to be strict lane dividers',
    '至少加载两条线数据': 'Load at least two line datasets',
    '至少加载两条线数据，该处所加载的设计数据的用来提取道路的设计纵坡和设计横坡':
        'Load at least two line datasets used to extract design longitudinal/cross slopes',
    '至少加载两条原始道路线': 'Load at least two raw road lines',
    '智慧大屏': 'Smart screen',
    '重命名': 'Rename',
    '重置': 'Reset',
    '重置主题': 'Reset theme',
    '主题设置': 'Theme settings',
    '主题颜色': 'Theme color',
    '注意：不允许输入中文、特殊字符等。如果出现对不起，当前页面无法访问，大概率是跳转参数的问题！！':
        'Note: Chinese/special characters are not allowed. If the page cannot be opened, check jump parameters.',
    '转换后的屏幕坐标:': 'Converted screen coordinates:',
    '桩号': 'Station',
    '桩号,X,Y,平滑前Z,平滑后Z,高程差(cm),平滑前横坡,平滑后横坡,平滑前纵坡,平滑后纵坡':
        'Station,X,Y,Z before,Z after,Elev diff(cm),Cross before,Cross after,Long before,Long after',
    '状态': 'Status',
    '自定义链接': 'Custom link',
    '自动展示纵横坡数据': 'Auto show slope data',
    'element图标': 'Element icons',
    'getTableColumns: 从 DOM 获取列配置失败': 'getTableColumns: failed to get columns from DOM',
    'getTableColumns: 从 store 获取列配置失败': 'getTableColumns: failed to get columns from store',
    'getTableColumns: 列配置不完整': 'getTableColumns: incomplete column config',
    'getTableColumns: 通过选择器查找表格元素，可能不准确':
        'getTableColumns: found table via selector, may be inaccurate',
    'getTableColumns: 未能获取到列配置': 'getTableColumns: failed to get column config',
    'getTableColumns: 无法找到表格 DOM 元素': 'getTableColumns: table DOM not found',
    'getTableColumns: tableInstance 为空': 'getTableColumns: tableInstance is empty',
    'getTableColumns: tableRef 为空': 'getTableColumns: tableRef is empty',
    'GPS坐标转换出错:': 'GPS coordinate conversion error:',
    'X坐标': 'X',
    'Y坐标': 'Y'
}

const CN_RE = /[\u4e00-\u9fff]/

function looksChinese(text) {
    return CN_RE.test(String(text || ''))
}

/**
 * 已有英文（或不含汉字的译文）一律保留，除非 --force。
 * 仅以下情况视为「未翻译 / 中文占位」：
 * - 缺失 / 空串
 * - value === key（extract/sync 写入的中文占位）
 * - value 仍含汉字（占位或未翻完）
 */
function isAlreadyEnglish(key, current) {
    if (current == null || current === '') return false
    if (current === key) return false
    // 不含汉字 → 视为已译英文（或符号/数字），绝不覆盖
    if (!looksChinese(current)) return true
    return false
}

function needsTranslation(key, current, force = false) {
    if (force) return true
    return !isAlreadyEnglish(key, current)
}

function loadExtraDict() {
    const merged = {}
    if (fs.existsSync(EXTRA_DICT_FILE)) {
        try {
            Object.assign(merged, JSON.parse(fs.readFileSync(EXTRA_DICT_FILE, 'utf8') || '{}'))
        } catch (e) {
            console.warn('[i18n:fill-en] load i18n-en-extra.json failed:', e.message)
        }
    }
    try {
        if (fs.existsSync(DICT_DIR)) {
            for (const file of fs.readdirSync(DICT_DIR)) {
                if (/^i18n-en-.*\.json$/.test(file) && file !== 'i18n-en-extra.json') {
                    Object.assign(
                        merged,
                        JSON.parse(fs.readFileSync(path.join(DICT_DIR, file), 'utf8'))
                    )
                }
            }
        }
    } catch (e) {
        console.warn('[i18n:fill-en] load i18n-en-*.json failed:', e.message)
    }
    return merged
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

async function translateViaYoudao(text) {
    const body = new URLSearchParams({
        q: text,
        from: 'zh-CHS',
        to: 'en'
    })
    const res = await fetch('https://aidemo.youdao.com/trans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    })
    if (!res.ok) throw new Error(`youdao HTTP ${res.status}`)
    const data = await res.json()
    if (String(data.errorCode) !== '0' || !data.translation?.[0]) {
        throw new Error(`youdao errorCode=${data.errorCode}`)
    }
    return String(data.translation[0])
}

async function translateViaMyMemory(text) {
    const url =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(text) +
        '&langpair=zh|en'
    const res = await fetch(url)
    if (!res.ok) throw new Error(`mymemory HTTP ${res.status}`)
    const data = await res.json()
    const out = data?.responseData?.translatedText
    if (!out) throw new Error('mymemory empty')
    if (/MusicBrainz|MYMEMORY WARNING/i.test(out)) throw new Error('mymemory low quality')
    return String(out)
}

async function translateViaGoogle(text) {
    const { translate } = await import('google-translate-api-x')
    const res = await translate(text, { from: 'zh-CN', to: 'en' })
    return res.text
}

async function autoTranslate(text) {
    const errors = []
    // 有道遇 411 时退避重试
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const out = await translateViaYoudao(text)
            if (out && !looksChinese(out)) return out
            errors.push('youdao: still chinese')
            break
        } catch (e) {
            errors.push(`youdao: ${e.message}`)
            if (/411|429|rate|timeout/i.test(e.message)) {
                await sleep(1200 * (attempt + 1))
                continue
            }
            break
        }
    }

    for (const [name, fn] of [
        ['google', translateViaGoogle],
        ['mymemory', translateViaMyMemory]
    ]) {
        try {
            const out = await fn(text)
            if (out && !looksChinese(out)) return out
            errors.push(`${name}: still chinese`)
        } catch (e) {
            errors.push(`${name}: ${e.message}`)
        }
    }
    throw new Error(errors.join(' | '))
}

function classify(zh, en, mergedDict, keysFilter = null, force = false) {
    let kept = 0
    let fromDictReady = 0
    const pendingAuto = []
    const dictHits = []
    const sourceKeys = keysFilter ? [...keysFilter] : Object.keys(zh)

    for (const key of sourceKeys) {
        if (isMetaKey(key)) continue
        if (!(key in zh)) continue
        const current = en[key]
        const dictVal = mergedDict[key]

        if (!needsTranslation(key, current, force)) {
            kept++
            continue
        }

        if (dictVal && typeof dictVal === 'string' && dictVal.length && !looksChinese(dictVal)) {
            dictHits.push(key)
            fromDictReady++
            continue
        }

        pendingAuto.push(key)
    }

    return { kept, fromDictReady, pendingAuto, dictHits }
}

export async function runTranslateEn(argv = process.argv.slice(2)) {
    const { force, auto, checkOnly, autoLimit, delayMs, keysFile } = parseTranslateEnArgs(argv)
    const { sourceLocale, reportsDir, root } = getContext()
    const mergedDict = { ...DICT, ...loadExtraDict() }
    const zh = load(sourceLocale)
    const en = load('en-US')
    const keysFilter = loadKeysFilter(keysFile)

    const { kept, fromDictReady, pendingAuto, dictHits } = classify(
        zh,
        en,
        mergedDict,
        keysFilter,
        force
    )

    console.log(`[i18n:fill-en] ${sourceLocale} keys: ${Object.keys(zh).length}`)
    if (keysFilter) console.log(`[i18n:fill-en] keys filter: ${keysFilter.size} (changed-scope only)`)
    console.log(`[i18n:fill-en] already English (will KEEP): ${kept}`)
    console.log(`[i18n:fill-en] can fill from dict: ${fromDictReady}`)
    console.log(`[i18n:fill-en] need online translate: ${pendingAuto.length}`)
    if (force) console.log(`[i18n:fill-en] WARNING: --force enabled, may overwrite English`)

    fs.mkdirSync(reportsDir, { recursive: true })
    fs.writeFileSync(
        path.join(reportsDir, 'i18n-untranslated-keys.json'),
        JSON.stringify(pendingAuto, null, 2),
        'utf8'
    )
    console.log(
        `[i18n:fill-en] pending list -> ${path.relative(root, path.join(reportsDir, 'i18n-untranslated-keys.json'))}`
    )

    if (checkOnly) {
        console.log(`[i18n:fill-en] check-only, no files written`)
        return
    }

    if (!auto && fromDictReady === 0) {
        console.log(
            `[i18n:fill-en] Tip: run "i18n-auto fill-en --auto" to auto-translate pending keys (keeps existing English)`
        )
        return
    }

    let fromDict = 0
    for (const key of dictHits) {
        if (!force && isAlreadyEnglish(key, en[key])) continue
        en[key] = mergedDict[key]
        fromDict++
    }
    if (fromDict) {
        save('en-US', en)
        console.log(`[i18n:fill-en] dict applied: ${fromDict}`)
    }

    if (!auto) {
        console.log(
            `[i18n:fill-en] remaining online: ${pendingAuto.length}. Run: i18n-auto fill-en --auto`
        )
        return
    }

    const batch = pendingAuto.slice(0, autoLimit)
    console.log(
        `[i18n:fill-en] auto translating ${batch.length}/${pendingAuto.length} (delay=${delayMs}ms)...`
    )

    let fromAuto = 0
    let failed = 0
    let consecutiveFail = 0

    for (let i = 0; i < batch.length; i++) {
        const key = batch[i]

        if (!force && isAlreadyEnglish(key, en[key])) continue

        try {
            const translated = await autoTranslate(key)
            if (!translated || looksChinese(translated)) {
                throw new Error(`bad translation result: ${String(translated).slice(0, 40)}`)
            }
            en[key] = translated
            fromAuto++
            consecutiveFail = 0
            if ((i + 1) % 20 === 0) {
                save('en-US', en)
                console.log(`[i18n:fill-en] progress ${i + 1}/${batch.length} (ok=${fromAuto})`)
            }
            await sleep(delayMs)
        } catch (e) {
            failed++
            consecutiveFail++
            console.warn(`[i18n:fill-en] skip: ${key.slice(0, 40)} (${e.message})`)
            if (consecutiveFail >= 8) {
                save('en-US', en)
                console.error(
                    '[i18n:fill-en] stopped: too many consecutive network errors. Re-run to resume.'
                )
                break
            }
            await sleep(Math.max(delayMs * 5, 2000))
        }
    }

    save('en-US', en)

    const after = classify(zh, en, mergedDict, keysFilter, force)
    console.log(`[i18n:fill-en] auto translated this run: ${fromAuto}, failed: ${failed}`)
    console.log(`[i18n:fill-en] AFTER — keep: ${after.kept}, still pending: ${after.pendingAuto.length}`)
}
