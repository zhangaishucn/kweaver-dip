import { memo, useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import DipChatKit from '@/components/DipChatKit'
import { parseAgentIdFromSessionKey } from '@/components/DipChatKit/utils'
import useSyncHistorySessions from '@/hooks/useSyncHistorySessions'
import type { ConversationRouteState } from './types'

const SUBMIT_CONSUMED_PREFIX = 'dip-chatkit-submit-consumed'

const EMPTY_ROUTE_STATE: ConversationRouteState & Record<string, unknown> = {}

const Conversation = () => {
  useSyncHistorySessions()

  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const employeeFromQuery = searchParams.get('employee')?.trim() || ''
  const sessionKeyFromQuery = searchParams.get('sessionKey')?.trim() || ''
  /** 无 state 时用模块级常量，避免每次渲染新对象导致依赖 routeState 的 effect 无限触发 */
  const routeState = (
    location.state ? (location.state as ConversationRouteState & Record<string, unknown>) : EMPTY_ROUTE_STATE
  )
  const submitData = routeState.submitData
  const submitToken = routeState.submitToken?.trim() || ''
  const consumedStorageKey = submitToken ? `${SUBMIT_CONSUMED_PREFIX}:${submitToken}` : ''

  const activeSessionIdProp = sessionKeyFromQuery || undefined

  const initialSubmitPayload = useMemo(() => {
    if (!submitData) return undefined
    if (!consumedStorageKey) return submitData
    const consumed = window.sessionStorage.getItem(consumedStorageKey) === '1'
    return consumed ? undefined : submitData
  }, [consumedStorageKey, submitData])

  const defaultEmployeeValue = useMemo(() => {
    if (employeeFromQuery) {
      return employeeFromQuery
    }
    return submitData?.employees?.[0]?.value
  }, [employeeFromQuery, submitData])

  /**
   * URL 中 employee 与 sessionKey 内含 agent 不一致时移除 sessionKey，
   * 避免切换数字员工后仍挂载旧线程（与侧栏钉选「新开对话」语义对齐）。
   */
  useEffect(() => {
    if (!employeeFromQuery || !sessionKeyFromQuery) return

    const agentFromSession = parseAgentIdFromSessionKey(sessionKeyFromQuery)
    if (!agentFromSession || agentFromSession === employeeFromQuery) return

    const nextSearchParams = new URLSearchParams(location.search)
    nextSearchParams.delete('sessionKey')
    const nextSearch = nextSearchParams.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true, state: location.state ?? null },
    )
  }, [employeeFromQuery, location.pathname, location.search, location.state, navigate, sessionKeyFromQuery])

  useEffect(() => {
    if (!initialSubmitPayload) return

    if (consumedStorageKey) {
      window.sessionStorage.setItem(consumedStorageKey, '1')
    }

    if (!(submitData || submitToken)) return
    const prevState =
      location.state != null ? (location.state as Record<string, unknown>) : EMPTY_ROUTE_STATE
    const nextState: Record<string, unknown> = { ...prevState }
    delete nextState.submitData
    delete nextState.submitToken
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state: Object.keys(nextState).length > 0 ? nextState : null,
      },
    )
  }, [
    consumedStorageKey,
    initialSubmitPayload,
    location.pathname,
    location.search,
    location.state,
    navigate,
    submitData,
    submitToken,
  ])

  const handleSessionKeyReady = useCallback(
    (sessionKey: string) => {
      const normalizedSessionKey = sessionKey.trim()
      if (!normalizedSessionKey || normalizedSessionKey === sessionKeyFromQuery) return

      const nextSearchParams = new URLSearchParams(location.search)
      nextSearchParams.set('sessionKey', normalizedSessionKey)
      navigate(
        {
          pathname: location.pathname,
          search: `?${nextSearchParams.toString()}`,
        },
        {
          replace: true,
          state: location.state ?? null,
        },
      )
    },
    [location.pathname, location.search, location.state, navigate, sessionKeyFromQuery],
  )

  return (
    <div className="h-full w-full box-border">
      <div className="h-full min-h-0">
        <DipChatKit
          initialSubmitPayload={initialSubmitPayload}
          sessionId={activeSessionIdProp}
          assignEmployeeValue={defaultEmployeeValue}
          onSessionKeyReady={handleSessionKeyReady}
        />
      </div>
    </div>
  )
}

export default memo(Conversation)
