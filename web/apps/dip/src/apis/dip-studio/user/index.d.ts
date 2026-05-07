/** 侧栏钉选单行（与 OpenAPI `SidebarPinnedDigitalHuman` 一致；仅含当前仍可解析的数字员工） */
export interface SidebarPinnedDigitalHuman {
  id: string
  name: string
  creature?: string
  icon_id?: string
}

/** 侧栏钉选快照（与 OpenAPI `SidebarPinnedDigitalHumansState` 一致） */
export interface SidebarPinnedDigitalHumansState {
  /** 自上而下 = 按添加时间倒序；至多 8 项 */
  pinned_digital_humans: SidebarPinnedDigitalHuman[]
}

/** POST 请求体：钉选或置顶一个数字员工（仅单个 id） */
export type PostSidebarPinnedDigitalHumansBody = {
  pinned_digital_human_id: string
}
