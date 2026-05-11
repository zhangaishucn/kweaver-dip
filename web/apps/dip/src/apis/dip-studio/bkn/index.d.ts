export type BknKnowledgeNetworksSortField = 'update_time' | 'name'

export type BknKnowledgeNetworksDirection = 'asc' | 'desc'

export interface GetBknKnowledgeNetworksParams {
  name_pattern?: string
  sort?: BknKnowledgeNetworksSortField
  direction?: BknKnowledgeNetworksDirection
  offset?: number
  limit?: number
  tag?: string
  include_statistics?: boolean
}

export interface BknKnowledgeNetworkStatistics {
  object_types_total?: number
  relation_types_total?: number
  action_types_total?: number
}

export interface BknKnowledgeNetworkInfo {
  id: string
  name: string
  comment?: string
  icon?: string
  color?: string
  statistics?: BknKnowledgeNetworkStatistics
  update_time?: number
  [key: string]: unknown
}

export interface BknKnowledgeNetworksListResponse {
  entries: BknKnowledgeNetworkInfo[]
  total_count: number
}

export interface GetBknKnowledgeNetworkDetailParams {
  mode?: '' | 'export'
  include_statistics?: boolean
}

export type BknKnowledgeNetworkDetail = Record<string, unknown>
