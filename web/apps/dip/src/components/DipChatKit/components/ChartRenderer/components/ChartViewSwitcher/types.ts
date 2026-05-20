import type { ReactNode } from 'react'
import type { DipChatKitChartDisplayMode } from '../../types'

export interface ChartViewSwitcherItem {
  key: Exclude<DipChatKitChartDisplayMode, 'table'>
  label: string
  icon: ReactNode
}

export interface ChartViewSwitcherProps {
  activeDisplayMode: DipChatKitChartDisplayMode
  lastChartDisplayMode: Exclude<DipChatKitChartDisplayMode, 'table'>
  items: ChartViewSwitcherItem[]
  className?: string
  isInModal?: boolean
  onSelectChartMode: (mode: Exclude<DipChatKitChartDisplayMode, 'table'>) => void
  onShowTable: () => void
}
