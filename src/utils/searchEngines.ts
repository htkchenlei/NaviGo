export type SearchEngineKey = 'google' | 'baidu' | 'bing'

export interface SearchEngine {
  key: SearchEngineKey
  label: string
  /** 单字标记：不依赖任何品牌图标字体，中文引擎也能一眼认出 */
  mark: string
  markClass: string
  dotClass: string
  /** 关键词查询地址，查询词由 buildSearchUrl 做 encodeURIComponent */
  searchUrl: string
  homeUrl: string
  placeholder: string
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    key: 'google',
    label: 'Google',
    mark: 'G',
    markClass: 'bg-macaron-sky-soft text-ink',
    dotClass: 'bg-macaron-sky',
    searchUrl: 'https://www.google.com/search?q=',
    homeUrl: 'https://www.google.com/',
    placeholder: '用 Google 搜索',
  },
  {
    key: 'baidu',
    label: '百度',
    mark: '百',
    markClass: 'bg-macaron-coral-soft text-ink',
    dotClass: 'bg-macaron-coral',
    searchUrl: 'https://www.baidu.com/s?wd=',
    homeUrl: 'https://www.baidu.com/',
    placeholder: '用百度搜索',
  },
  {
    key: 'bing',
    label: 'Bing',
    mark: 'B',
    markClass: 'bg-macaron-teal-soft text-ink',
    dotClass: 'bg-macaron-teal',
    searchUrl: 'https://www.bing.com/search?q=',
    homeUrl: 'https://www.bing.com/',
    placeholder: '用 Bing 搜索',
  },
]

/** 未知 / 缺失时一律回退到第一个（Google），保证界面永远有可用的搜索引擎 */
export function engineOf(key: string | undefined | null): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.key === key) ?? SEARCH_ENGINES[0]
}

export function buildSearchUrl(engine: SearchEngine, query: string): string {
  return `${engine.searchUrl}${encodeURIComponent(query)}`
}
