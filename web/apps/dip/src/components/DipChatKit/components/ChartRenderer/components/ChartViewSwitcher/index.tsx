import {
  BarChartOutlined,
  DashboardOutlined,
  DownOutlined,
  PieChartOutlined,
} from '@ant-design/icons'
import type { MenuProps, RadioChangeEvent } from 'antd'
import { Button, Dropdown, Radio, Tooltip } from 'antd'
import clsx from 'clsx'
import type React from 'react'
import { useMemo } from 'react'
import intl from 'react-intl-universal'
import IconFont from '@/components/IconFont'
import type { DipChatKitChartDisplayMode } from '../../types'
import styles from './index.module.less'
import type { ChartViewSwitcherItem, ChartViewSwitcherProps } from './types'

const getBuiltInIcon = (mode: DipChatKitChartDisplayMode): React.ReactNode => {
  if (mode === 'table') {
    return <IconFont type="icon-table" />
  }

  if (mode === 'column') {
    return <BarChartOutlined />
  }

  if (mode === 'line') {
    return <IconFont type="icon-echats" />
  }

  if (mode === 'donut') {
    return <DashboardOutlined />
  }

  return <PieChartOutlined />
}

export const buildChartViewSwitcherItems = (): ChartViewSwitcherItem[] => {
  return [
    {
      key: 'donut',
      label: intl.get('dipChatKit.chartTypeDonut').d('环形图') as string,
      icon: getBuiltInIcon('donut'),
    },
    {
      key: 'column',
      label: intl.get('dipChatKit.chartTypeColumn').d('柱状图') as string,
      icon: getBuiltInIcon('column'),
    },
    {
      key: 'line',
      label: intl.get('dipChatKit.chartTypeLine').d('折线图') as string,
      icon: getBuiltInIcon('line'),
    },
    {
      key: 'pie',
      label: intl.get('dipChatKit.chartTypePie').d('饼图') as string,
      icon: getBuiltInIcon('pie'),
    },
  ]
}

const ChartViewSwitcher: React.FC<ChartViewSwitcherProps> = ({
  activeDisplayMode,
  lastChartDisplayMode,
  items,
  className,
  isInModal,
  onSelectChartMode,
  onShowTable,
}) => {
  const activeChartItem = useMemo(() => {
    return items.find((item) => item.key === lastChartDisplayMode) || items[0]
  }, [items, lastChartDisplayMode])

  const chartMenuItems = useMemo<MenuProps['items']>(() => {
    return items.map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
    }))
  }, [items])

  const radioOptions = useMemo(() => {
    const tableLabel = intl.get('dipChatKit.chartTypeTable').d('表格') as string

    return [
      {
        label: (
          <div className={styles.radioOptionLabel}>
            <span className={styles.iconSlot}>{getBuiltInIcon('table')}</span>
            <span className={styles.radioOptionText}>{tableLabel}</span>
          </div>
        ),
        value: 'table' as const,
      },
      ...items.map((item) => ({
        label: (
          <div className={styles.radioOptionLabel}>
            <span className={styles.iconSlot}>{item.icon}</span>
            <span className={styles.radioOptionText}>{item.label}</span>
          </div>
        ),
        value: item.key,
      })),
    ]
  }, [items])

  const handleRadioChange = (event: RadioChangeEvent) => {
    const nextMode = event.target.value as DipChatKitChartDisplayMode

    if (nextMode === 'table') {
      onShowTable()
      return
    }

    onSelectChartMode(nextMode)
  }

  const switchToTableTitle = intl.get('dipChatKit.chartSwitchToTable').d('切换为表格') as string
  const switchChartTypeTitle = intl.get('dipChatKit.chartSwitchType').d('切换图表类型') as string

  return (
    <div className={clsx('ChartViewSwitcher', styles.root, className)}>
      {isInModal ? (
        <Radio.Group
          block
          options={radioOptions}
          optionType="button"
          value={activeDisplayMode}
          onChange={handleRadioChange}
        />
      ) : (
        <>
          <Tooltip title={switchToTableTitle}>
            <Button
              size="small"
              type={activeDisplayMode === 'table' ? 'primary' : 'default'}
              icon={getBuiltInIcon('table')}
              onClick={onShowTable}
            />
          </Tooltip>
          <div className={styles.chartActionGroup}>
            <Dropdown
              menu={{
                items: chartMenuItems,
                selectable: true,
                selectedKeys: [
                  activeDisplayMode === 'table' ? lastChartDisplayMode : activeDisplayMode,
                ],
                onClick: ({ key }) => {
                  onSelectChartMode(key as Exclude<DipChatKitChartDisplayMode, 'table'>)
                },
              }}
              placement="bottomRight"
            >
              <span>
                <Tooltip title={switchChartTypeTitle}>
                  <Button
                    size="small"
                    type={activeDisplayMode === 'table' ? 'default' : 'primary'}
                    icon={activeChartItem.icon}
                  >
                    <DownOutlined />
                  </Button>
                </Tooltip>
              </span>
            </Dropdown>
          </div>
        </>
      )}
    </div>
  )
}

export default ChartViewSwitcher
