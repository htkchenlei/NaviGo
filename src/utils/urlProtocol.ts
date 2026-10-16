/**
 * 地址协议工具。
 *
 * 表单把「协议」和「主机」拆成两个控件：协议用下拉框选，输入框里只填主机和端口。
 * 提交时由 joinUrl 拼回完整地址，服务端仍然只接受 http:// 或 https:// 开头的地址，
 * 所以存库格式和以前完全一致，历史数据不用迁移。
 */

/** 与 service 端 optUrl 的协议白名单保持一致，不允许第三种取值 */
export type Protocol = 'http' | 'https'

export const PROTOCOLS: Protocol[] = ['http', 'https']

/**
 * 把一段用户输入拆成「协议 + 主机」。
 * 关键是处理「用户直接粘贴完整地址」的情况：把协议头吸到下拉框里，
 * 否则会拼出 http://https://a.b 这种坏地址。
 */
export function splitProtocol(
  raw: string,
  fallback: Protocol,
): { protocol: Protocol; host: string } {
  const matched = /^\s*(https?):\/\/\s*(.*)$/i.exec(raw)
  if (!matched) return { protocol: fallback, host: raw.trim() }
  return { protocol: matched[1].toLowerCase() as Protocol, host: matched[2].trim() }
}

/** 编辑已有链接时，把库里存的完整地址回填成两个控件 */
export function parseStoredUrl(
  url: string | null,
  fallback: Protocol,
): { protocol: Protocol; host: string } {
  if (!url) return { protocol: fallback, host: '' }
  return splitProtocol(url, fallback)
}

/** 提交前拼回完整地址；主机为空表示这个模式不填地址，返回 null 让服务端存 NULL */
export function joinUrl(protocol: Protocol, host: string): string | null {
  const trimmed = host.trim()
  return trimmed ? `${protocol}://${trimmed}` : null
}

/** 主机段的客户端校验：返回错误文案，null 表示通过。协议已经由下拉框保证，这里只挡明显不合法的输入 */
export function validateHost(host: string, label: string): string | null {
  const trimmed = host.trim()
  if (!trimmed) return null
  if (/\s/.test(trimmed)) return `${label}不能包含空格`
  if (/:\/\//.test(trimmed)) return `${label}只填主机和端口，不用再写协议`
  return null
}
