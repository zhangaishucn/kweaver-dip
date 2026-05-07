import { DownOutlined, EllipsisOutlined, PushpinFilled, UpOutlined } from '@ant-design/icons'
import { Popover, Tooltip } from 'antd'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import intl from 'react-intl-universal'
import {
  createSearchParams,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import type { SidebarPinnedDigitalHuman } from '@/apis/dip-studio/user'
import AppIcon from '@/components/AppIcon'
import { usePinnedDigitalHumansStore } from '@/stores/pinnedDigitalHumansStore'
import { resolveDigitalHumanIconSrc } from '@/utils/digital-human/resolveDigitalHumanIcon'
import { formatTotalDisplay } from '../utils'

/** 侧栏钉选区默认展开条数，超出部分收纳到「更多」，悬浮查看全部 */
const SIDEBAR_PINNED_VISIBLE_MAX = 3

export interface PinnedDigitalHumansSectionProps {
  /** 钉选行数据（服务端已组合档案；为空时父级不渲染本区块） */
  items: SidebarPinnedDigitalHuman[]
}

function PinnedDigitalHumanRow({
  human,
  employeeFromQuery,
  navigate,
  onUnpin,
}: {
  human: SidebarPinnedDigitalHuman
  employeeFromQuery: string
  navigate: NavigateFunction
  onUnpin: (id: string) => void
}) {
  const avatarSrc = resolveDigitalHumanIconSrc(human.icon_id)
  const isActive = employeeFromQuery !== '' && employeeFromQuery === human.id
  const unpinLabel = intl.get('sider.unpin')

  return (
    <div
      className={clsx(
        'flex w-full items-center gap-0.5 rounded-md min-h-10 px-2 py-1.5',
        isActive
          ? 'bg-[#f1f7fe] text-[--dip-primary-color]'
          : 'bg-transparent hover:bg-[--dip-hover-bg-color]',
      )}
    >
      <button
        type="button"
        onClick={() => {
          navigate({
            pathname: '/studio/conversation',
            search: `?${createSearchParams({
              employee: human.id,
            }).toString()}`,
          })
        }}
        className={clsx(
          'flex flex-1 min-w-0 items-center gap-2 border-0 bg-transparent cursor-pointer text-left rounded-md p-0',
          isActive ? 'text-[--dip-primary-color]' : 'text-[--dip-text-color]',
        )}
      >
        <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-md">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-8 w-8 object-cover" />
          ) : (
            <AppIcon name={human.name} size={32} className="h-8 w-8" shape="square" />
          )}
        </div>
        <span className="flex-1 min-w-0 truncate text-sm" title={human.name}>
          {human.name}
        </span>
      </button>
      <Tooltip title={unpinLabel} placement="top">
        <button
          type="button"
          className={clsx(
            'w-6 h-6 shrink-0 inline-flex items-center justify-center rounded border-0 bg-transparent cursor-pointer transition-colors',
            isActive
              ? 'text-[var(--dip-primary-color)] opacity-80 hover:opacity-100 hover:bg-[rgba(22,119,255,0.08)]'
              : 'text-[var(--dip-text-color-45)] hover:text-[var(--dip-primary-color)] hover:bg-[rgba(0,0,0,0.04)]',
          )}
          aria-label={unpinLabel}
          onClick={(e) => {
            e.stopPropagation()
            void onUnpin(human.id)
          }}
        >
          <PushpinFilled className="text-sm" aria-hidden />
        </button>
      </Tooltip>
    </div>
  )
}

/**
 * Studio 侧栏「常用数字员工」区块（折叠形态与工作计划区等一致）。
 */
export const PinnedDigitalHumansSection = ({ items }: PinnedDigitalHumansSectionProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const unpinSidebarDigitalHuman = usePinnedDigitalHumansStore((s) => s.unpinSidebarDigitalHuman)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const employeeFromQuery = useMemo(() => {
    if (!location.pathname.startsWith('/studio/conversation')) return ''
    const params = new URLSearchParams(location.search)
    return params.get('employee')?.trim() || ''
  }, [location.pathname, location.search])

  const visibleItems = useMemo(
    () => items.slice(0, SIDEBAR_PINNED_VISIBLE_MAX),
    [items],
  )
  const overflowItems = useMemo(() => items.slice(SIDEBAR_PINNED_VISIBLE_MAX), [items])

  if (items.length === 0) {
    return null
  }

  const morePopoverContent =
    overflowItems.length === 0 ? null : (
      <div
        className="flex flex-col gap-0.5 py-1 min-w-[200px] max-w-[260px] max-h-[min(60vh,320px)] overflow-y-auto dip-hideScrollbar"
        aria-label={intl.get('sider.pinnedDigitalHumans.morePopoverAria')}
      >
        {overflowItems.map((human) => (
          <PinnedDigitalHumanRow
            key={`pinned-digital-human-overflow-${human.id}`}
            human={human}
            employeeFromQuery={employeeFromQuery}
            navigate={navigate}
            onUnpin={(id) => {
              void unpinSidebarDigitalHuman(id)
            }}
          />
        ))}
      </div>
    )

  return (
    <div className="px-2 py-1" aria-label={intl.get('sider.pinnedDigitalHumans.sectionAria')}>
      <div className="flex items-center justify-between px-2 py-1">
        <button
          type="button"
          className="text-xs leading-[20px] text-[--dip-text-color-45] bg-transparent border-0 p-0 cursor-pointer flex flex-1 items-center"
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          {intl.get('sider.pinnedDigitalHumans.sectionTitle', { count: formatTotalDisplay(items.length) })}
          {isCollapsed ? <UpOutlined className="text-xs" /> : <DownOutlined className="text-xs" />}
        </button>
      </div>
      {isCollapsed ? null : (
        <div className="flex flex-col gap-0.5">
          {visibleItems.map((human) => (
            <PinnedDigitalHumanRow
              key={`pinned-digital-human-${human.id}`}
              human={human}
              employeeFromQuery={employeeFromQuery}
              navigate={navigate}
              onUnpin={(id) => {
                void unpinSidebarDigitalHuman(id)
              }}
            />
          ))}
          {overflowItems.length > 0 ? (
            <Popover
              trigger={['hover', 'click']}
              placement="rightTop"
              mouseEnterDelay={0.12}
              mouseLeaveDelay={0.25}
              overlayClassName="pinned-digital-humans-more-popover"
              arrow={false}
              content={morePopoverContent}
            >
              <button
                type="button"
                className={clsx(
                  'flex w-full items-center gap-2 rounded-md min-h-10 px-2 py-1.5 border-0 bg-transparent cursor-pointer text-left',
                  'text-[var(--dip-text-color-45)] hover:bg-[--dip-hover-bg-color] hover:text-[var(--dip-text-color)]',
                )}
                aria-label={intl.get('sider.pinnedDigitalHumans.morePopoverAria')}
              >
                <span className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md bg-[rgba(0,0,0,0.04)]">
                  <EllipsisOutlined className="text-base text-[var(--dip-text-color-45)]" aria-hidden />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">
                  {intl.get('sider.pinnedDigitalHumans.moreCollapsed', {
                    count: formatTotalDisplay(overflowItems.length),
                  })}
                </span>
              </button>
            </Popover>
          ) : null}
        </div>
      )}
    </div>
  )
}
