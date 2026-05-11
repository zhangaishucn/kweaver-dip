import { get } from '@/utils/http'
import type {
  BknKnowledgeNetworkDetail,
  BknKnowledgeNetworkInfo,
  BknKnowledgeNetworkStatistics,
  BknKnowledgeNetworksListResponse,
  GetBknKnowledgeNetworkDetailParams,
  GetBknKnowledgeNetworksParams,
} from './index.d'

export type {
  BknKnowledgeNetworkDetail,
  BknKnowledgeNetworkInfo,
  BknKnowledgeNetworkStatistics,
  BknKnowledgeNetworksDirection,
  BknKnowledgeNetworksListResponse,
  BknKnowledgeNetworksSortField,
  GetBknKnowledgeNetworkDetailParams,
  GetBknKnowledgeNetworksParams,
} from './index.d'

const BASE = '/api/dip-studio/v1'

function cleanParams<T extends Record<string, unknown>>(obj?: T): T | undefined {
  if (!obj) return undefined
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as T
}

function normalizeKnowledgeNetwork(item: Record<string, unknown>): BknKnowledgeNetworkInfo {
  const id = String(item.id ?? item.kn_id ?? '')
  const name = String(item.name ?? item.kn_name ?? '')
  const updateTime = item.update_time
  const parsedUpdateTime =
    typeof updateTime === 'number'
      ? updateTime
      : typeof updateTime === 'string' && updateTime.trim() !== ''
        ? Number(updateTime)
        : undefined

  return {
    ...item,
    id,
    name,
    comment: typeof item.comment === 'string' ? item.comment : undefined,
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    color: typeof item.color === 'string' ? item.color : undefined,
    statistics: normalizeStatistics(item.statistics),
    update_time: Number.isFinite(parsedUpdateTime) ? parsedUpdateTime : undefined,
  }
}

function normalizeStatistics(value: unknown): BknKnowledgeNetworkStatistics | undefined {
  if (!value || typeof value !== 'object') return undefined

  const statistics = value as Record<string, unknown>
  const objectTypesTotal = normalizeCount(
    statistics.object_types_total ?? statistics.object_type_totals,
  )
  const relationTypesTotal = normalizeCount(
    statistics.relation_types_total ?? statistics.relation_type_totals,
  )
  const actionTypesTotal = normalizeCount(
    statistics.action_types_total ?? statistics.action_type_totals,
  )

  return {
    object_types_total: objectTypesTotal,
    relation_types_total: relationTypesTotal,
    action_types_total: actionTypesTotal,
  }
}

function normalizeCount(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 获取业务知识网络列表（GET /knowledge-networks） */
export const getBknKnowledgeNetworks = (
  params?: GetBknKnowledgeNetworksParams,
): Promise<BknKnowledgeNetworksListResponse> => {
  const p1 = get(`${BASE}/knowledge-networks`, {
    params: cleanParams(params as Record<string, unknown> | undefined),
    skipAuthRefreshOn401: true,
  })

  const p2 = p1.then((result: unknown) => {
    const data = (result ?? {}) as Record<string, unknown>
    const rawEntries = Array.isArray(data.entries)
      ? data.entries
      : Array.isArray(data.items)
        ? data.items
        : []
    const entries = rawEntries
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(normalizeKnowledgeNetwork)
    const totalCount =
      typeof data.total_count === 'number'
        ? data.total_count
        : typeof data.total === 'number'
          ? data.total
          : entries.length

    return {
      entries,
      total_count: totalCount,
    }
  })

  p2.abort = p1.abort
  return p2
}

/** 获取业务知识网络详情（GET /knowledge-networks/{kn_id}） */
export const getBknKnowledgeNetworkById = (
  knId: string,
  params?: GetBknKnowledgeNetworkDetailParams,
): Promise<BknKnowledgeNetworkDetail> =>
  get(`${BASE}/knowledge-networks/${encodeURIComponent(knId)}`, {
    params: cleanParams(params as Record<string, unknown> | undefined),
  }) as Promise<BknKnowledgeNetworkDetail>
