import { Card } from 'antd'
import type { ReactNode } from 'react'
import { useState } from 'react'
import intl from 'react-intl-universal'
import type { DigitalHuman } from '@/apis'
import { resolveDigitalHumanIconSrc } from '@/utils/digital-human/resolveDigitalHumanIcon'
import AppIcon from '../AppIcon'
import IconFont from '../IconFont'
import { cardHeight } from './utils'

interface EmployeeCardProps {
  digitalHuman: DigitalHuman
  width: number
  /** 卡片右上角自定义区域（如侧栏钉选按钮）；不传则不展示 */
  cardTrailing?: ReactNode
  /** 卡片菜单点击回调 */
  onCardClick?: (digitalHuman: DigitalHuman) => void
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  digitalHuman,
  cardTrailing,
  onCardClick,
}) => {
  const [hovered, setHovered] = useState(false)
  const avatarSrc = resolveDigitalHumanIconSrc(digitalHuman.icon_id)
  const ext = digitalHuman as DigitalHuman & {
    skills?: unknown[]
    bkn?: unknown[]
    channel?: unknown
  }
  const skillCount = Array.isArray(ext.skills) ? ext.skills.length : 0
  const knowledgeCount = Array.isArray(ext.bkn) ? ext.bkn.length : 0
  const channelCount = ext.channel ? 1 : 0

  return (
    <Card
      className="group w-full cursor-pointer rounded-[20px] transition-all"
      styles={{
        root: {
          height: cardHeight,
          border: '1px solid #E2E8F0',
          boxShadow: hovered
            ? '0 20px 40px -18px rgba(0, 0, 0, 0.1), 0 12px 24px -12px rgba(0, 0, 0, 0.25)'
            : '0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
          overflow: 'hidden',
        },
        body: {
          height: '100%',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      onClick={() => {
        onCardClick?.(digitalHuman)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-x-4">
        <div className="w-14 h-14 flex-shrink-0 overflow-hidden rounded-xl">
          {avatarSrc ? (
            <img src={avatarSrc} alt={digitalHuman.name} className="w-14 h-14 object-cover" />
          ) : (
            <AppIcon name={digitalHuman.name} size={56} className="w-14 h-14" shape="square" />
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-xl font-bold truncate flex-1" title={digitalHuman.name}>
            {digitalHuman.name}
          </div>
          <p
            className="mt-2 text-sm leading-[22px] text-[rgba(0,0,0,0.5)] line-clamp-2 min-h-[44px]"
            title={digitalHuman.creature}
          >
            {digitalHuman.creature || intl.get('digitalHuman.card.noBio')}
          </p>
        </div>
        {cardTrailing ? (
          <div
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
            }}
            role="presentation"
          >
            {cardTrailing}
          </div>
        ) : null}
      </div>

      <div className="mt-auto -mx-6 -mb-6 px-6 h-12 bg-[#F8FAFC] flex items-center gap-7 text-xs leading-6 text-[rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-1">
          <IconFont type="icon-think" className="text-base text-black mr-0.5" />
          <span>{intl.get('digitalHuman.card.skillsCount', { count: skillCount })}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconFont type="icon-graph" className="text-base text-black mr-0.5" />
          <span>{intl.get('digitalHuman.card.knowledgeCount', { count: knowledgeCount })}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconFont type="icon-index-management" className="text-base text-black mr-0.5" />
          <span>{intl.get('digitalHuman.card.channelCount', { count: channelCount })}</span>
        </div>
      </div>
    </Card>
  )
}

export default EmployeeCard
