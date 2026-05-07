import { del, get, post } from '@/utils/http'
import type {
  PostSidebarPinnedDigitalHumansBody,
  SidebarPinnedDigitalHumansState,
} from './index.d'

const PINNED_DIGITAL_HUMANS = '/api/dip-studio/v1/pinned-digital-humans'

/**
 * 获取当前用户侧栏钉选列表；响应含服务端组合的 `pinned_digital_humans`（不要再用全量数字员工列表拼装）。
 * OpenAPI: GET /pinned-digital-humans
 */
export function getSidebarPinnedDigitalHumans(): Promise<SidebarPinnedDigitalHumansState> {
  return get(PINNED_DIGITAL_HUMANS)
}

/**
 * 钉选或置顶一个数字员工（请求体仅含 `pinned_digital_human_id`）；响应为完整钉选快照。
 * OpenAPI: POST /pinned-digital-humans
 */
export function postSidebarPinnedDigitalHumans(
  body: PostSidebarPinnedDigitalHumansBody,
): Promise<SidebarPinnedDigitalHumansState> {
  return post(PINNED_DIGITAL_HUMANS, {
    body: JSON.stringify(body),
  })
}

/**
 * 取消钉选一个数字员工。OpenAPI: DELETE /pinned-digital-humans/{pinnedDigitalHumanId}
 */
export function deleteSidebarPinnedDigitalHuman(
  pinnedDigitalHumanId: string,
): Promise<SidebarPinnedDigitalHumansState> {
  return del(
    `${PINNED_DIGITAL_HUMANS}/${encodeURIComponent(pinnedDigitalHumanId)}`,
  )
}
