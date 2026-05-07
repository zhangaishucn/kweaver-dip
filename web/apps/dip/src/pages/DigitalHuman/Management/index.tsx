import { PushpinFilled, PushpinOutlined } from '@ant-design/icons'
import { Button, message, Spin, Tooltip } from 'antd'
import clsx from 'clsx'
import { memo, useEffect, useRef, useState } from 'react'
import intl from 'react-intl-universal'
import { useNavigate } from 'react-router-dom'
import { type DigitalHuman, getDigitalHumanList } from '@/apis'
import DigitalHumanList from '@/components/DigitalHumanList'
import Empty from '@/components/Empty'
import IconFont from '@/components/IconFont'
import SearchInput from '@/components/SearchInput'
import { useListService } from '@/hooks/useListService'
import { usePinnedDigitalHumansStore } from '@/stores/pinnedDigitalHumansStore'
import { useUserInfoStore } from '@/stores/userInfoStore'

const Management = () => {
  const navigate = useNavigate()
  const isAdmin = useUserInfoStore((s) => s.isAdmin)
  const pinnedDigitalHumans = usePinnedDigitalHumansStore((s) => s.pinnedDigitalHumans)
  const pinSidebarDigitalHuman = usePinnedDigitalHumansStore((s) => s.pinSidebarDigitalHuman)
  const unpinSidebarDigitalHuman = usePinnedDigitalHumansStore((s) => s.unpinSidebarDigitalHuman)
  const [, messageContextHolder] = message.useMessage()
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const hasEverHadDataRef = useRef(false)
  const prevSearchValueRef = useRef('')
  const {
    items: digitalHumans,
    loading,
    error,
    searchValue,
    handleSearch,
    handleRefresh,
  } = useListService<DigitalHuman>({
    fetchFn: getDigitalHumanList,
  })

  // 对齐项目列表页：根据是否曾经有过数据、是否是搜索态，控制头部和空态展示逻辑
  useEffect(() => {
    const wasSearching = prevSearchValueRef.current !== ''

    if (!loading) {
      if (digitalHumans.length > 0) {
        setHasLoadedData(true)
        hasEverHadDataRef.current = true
      } else if (!searchValue && hasEverHadDataRef.current) {
        if (!wasSearching) {
          setHasLoadedData(false)
          hasEverHadDataRef.current = false
        }
      }
    }

    prevSearchValueRef.current = searchValue
  }, [loading, digitalHumans.length, searchValue])

  /** 新建数字员工（仅管理员） */
  const handleCreate = () => {
    navigate(`/studio/digital-human/setting`)
  }

  const handleCardClick = (digitalHuman: DigitalHuman) => {
    if (isAdmin) {
      navigate(`/studio/digital-human/${digitalHuman.id}/setting`)
      return
    }
    navigate(`/studio/digital-human/${digitalHuman.id}`)
  }

  const renderStateContent = () => {
    if (loading && !digitalHumans.length) {
      return <Spin />
    }

    if (error) {
      return (
        <Empty type="failed" title={intl.get('digitalHuman.management.loadFailedTitle')}>
          <Button type="primary" onClick={handleRefresh}>
            {intl.get('digitalHuman.management.retry')}
          </Button>
        </Empty>
      )
    }

    if (digitalHumans.length === 0) {
      if (searchValue) {
        return <Empty type="search" desc={intl.get('digitalHuman.management.emptySearchDesc')} />
      }
      return (
        <Empty
          title={intl.get('digitalHuman.management.emptyTitle')}
          subDesc={intl.get('digitalHuman.management.emptySubDesc')}
        >
          {isAdmin ? (
            <Button
              className="mt-2"
              type="primary"
              icon={<IconFont type="icon-add" />}
              onClick={() => {
                handleCreate()
              }}
            >
              {intl.get('digitalHuman.management.createDigitalHuman')}
            </Button>
          ) : undefined}
        </Empty>
      )
    }

    return null
  }

  const renderContent = () => {
    const stateContent = renderStateContent()

    if (stateContent) {
      return <div className="absolute inset-0 flex items-center justify-center">{stateContent}</div>
    }

    return (
      <DigitalHumanList
        digitalHumans={digitalHumans}
        onCardClick={handleCardClick}
        cardTrailing={(digitalHuman) => {
          const pinned = pinnedDigitalHumans.some((row) => row.id === digitalHuman.id)
          const pinLabel = intl.get('digitalHuman.management.menuPinSidebar')
          const unpinLabel = intl.get('digitalHuman.management.menuUnpinSidebar')
          return (
            <Tooltip title={pinned ? unpinLabel : pinLabel}>
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={pinned ? unpinLabel : pinLabel}
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-md transition-colors border-0 cursor-pointer',
                  pinned
                    ? 'text-[var(--dip-primary-color)] bg-[rgba(22,119,255,0.06)] hover:bg-[rgba(22,119,255,0.12)]'
                    : 'bg-transparent text-[var(--dip-text-color-45)] hover:text-[var(--dip-primary-color)] hover:bg-[--dip-hover-bg-color]',
                )}
                onClick={() => {
                  if (pinned) void unpinSidebarDigitalHuman(digitalHuman.id)
                  else void pinSidebarDigitalHuman(digitalHuman.id)
                }}
              >
                {pinned ? (
                  <PushpinFilled className="text-base" aria-hidden />
                ) : (
                  <PushpinOutlined className="text-base" aria-hidden />
                )}
              </button>
            </Tooltip>
          )
        }}
      />
    )
  }

  return (
    <div className="h-full p-6 pb-0 flex flex-col relative bg-[#F8FAFC]">
      {messageContextHolder}
      <div className="flex justify-between items-center mb-4 flex-shrink-0 z-20">
        <span className="font-bold text-lg text-[--dip-text-color]">
          {intl.get('digitalHuman.management.listSectionAll')}
        </span>
        {(hasLoadedData || searchValue) && (
          <div className="flex items-center gap-x-3">
            <SearchInput
              onSearch={handleSearch}
              placeholder={intl.get('digitalHuman.management.searchPlaceholder')}
            />
            {isAdmin && (
              <Button type="primary" icon={<IconFont type="icon-add" />} onClick={handleCreate}>
                {intl.get('digitalHuman.management.createShort')}
              </Button>
            )}
            <Tooltip title={intl.get('digitalHuman.management.refresh')}>
              <Button type="text" icon={<IconFont type="icon-refresh" />} onClick={handleRefresh} />
            </Tooltip>
          </div>
        )}
      </div>
      {renderContent()}
    </div>
  )
}

export default memo(Management)
