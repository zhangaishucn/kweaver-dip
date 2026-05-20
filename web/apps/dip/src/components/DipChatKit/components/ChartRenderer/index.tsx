import { ExpandOutlined } from '@ant-design/icons'
import { Button, Modal, Tooltip } from 'antd'
import clsx from 'clsx'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import intl from 'react-intl-universal'
import ChartDataTable from './components/ChartDataTable'
import ChartViewSwitcher, { buildChartViewSwitcherItems } from './components/ChartViewSwitcher'
import styles from './index.module.less'
import type {
  ChartRendererProps,
  DipChatKitChartDisplayMode,
  DipChatKitChartPayload,
} from './types'
import {
  buildDipChatKitChartOption,
  buildDipChatKitChartOptionByDisplayMode,
  getDipChatKitChartDefaultDisplayMode,
  isDipChatKitChartSwitchable,
  normalizeDipChatKitChartDataset,
} from './utils'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

const getChartTypeLabel = (chartType: DipChatKitChartPayload['chartType']): string => {
  if (chartType === 'bar' || chartType === 'bar_horizontal') {
    return intl.get('dipChatKit.chartTypeBar').d('柱状图') as string
  }

  if (chartType === 'line') {
    return intl.get('dipChatKit.chartTypeLine').d('折线图') as string
  }

  if (chartType === 'pie') {
    return intl.get('dipChatKit.chartTypePie').d('饼图') as string
  }

  return intl.get('dipChatKit.chartTypeScatter').d('散点图') as string
}

const getChartDisplayModeLabel = (
  displayMode: Exclude<DipChatKitChartDisplayMode, 'table'>,
): string => {
  if (displayMode === 'column') {
    return intl.get('dipChatKit.chartTypeColumn').d('柱状图') as string
  }

  if (displayMode === 'line') {
    return intl.get('dipChatKit.chartTypeLine').d('折线图') as string
  }

  if (displayMode === 'donut') {
    return intl.get('dipChatKit.chartTypeDonut').d('环形图') as string
  }

  return intl.get('dipChatKit.chartTypePie').d('饼图') as string
}

const getChartTitleByLabel = (chart: DipChatKitChartPayload, chartLabel: string): string => {
  const customTitle = chart.title?.trim()
  if (customTitle) return customTitle
  return chart.plotId || chartLabel
}

const ChartRenderer: React.FC<ChartRendererProps> = ({
  chart,
  className,
  variant = 'inline',
  initialDisplayMode,
  isInModal = false,
  hideActions = false,
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const switcherItems = useMemo(() => buildChartViewSwitcherItems(), [])
  const switchableDataset = useMemo(() => {
    return normalizeDipChatKitChartDataset(chart)
  }, [chart])
  const canSwitchView = useMemo(() => {
    return isDipChatKitChartSwitchable(chart) && Boolean(switchableDataset)
  }, [chart, switchableDataset])
  const backendDisplayMode = useMemo(() => {
    return getDipChatKitChartDefaultDisplayMode(chart)
  }, [chart])
  const resolvedChartDisplayMode = useMemo<Exclude<DipChatKitChartDisplayMode, 'table'>>(() => {
    if (canSwitchView && initialDisplayMode && initialDisplayMode !== 'table') {
      return initialDisplayMode
    }

    return backendDisplayMode
  }, [backendDisplayMode, canSwitchView, initialDisplayMode])
  const resolvedInitialDisplayMode = useMemo<DipChatKitChartDisplayMode>(() => {
    if (canSwitchView && initialDisplayMode === 'table') {
      return 'table'
    }

    return resolvedChartDisplayMode
  }, [canSwitchView, initialDisplayMode, resolvedChartDisplayMode])
  const [activeDisplayMode, setActiveDisplayMode] = useState<DipChatKitChartDisplayMode>(
    resolvedInitialDisplayMode,
  )
  const [lastChartDisplayMode, setLastChartDisplayMode] =
    useState<Exclude<DipChatKitChartDisplayMode, 'table'>>(resolvedChartDisplayMode)
  const switcherSelectedDisplayMode =
    activeDisplayMode === 'table' ? backendDisplayMode : lastChartDisplayMode
  const currentChartDisplayMode =
    activeDisplayMode === 'table' ? backendDisplayMode : activeDisplayMode
  const isTableDisplayMode = canSwitchView && activeDisplayMode === 'table'
  const currentChartLabel = canSwitchView
    ? getChartDisplayModeLabel(
        currentChartDisplayMode as Exclude<DipChatKitChartDisplayMode, 'table'>,
      )
    : getChartTypeLabel(chart.chartType)
  const chartViewResult = useMemo(() => {
    if (isTableDisplayMode) {
      return null
    }

    if (canSwitchView && switchableDataset) {
      return buildDipChatKitChartOptionByDisplayMode(
        switchableDataset,
        currentChartDisplayMode as Exclude<DipChatKitChartDisplayMode, 'table'>,
        variant,
      )
    }

    return buildDipChatKitChartOption(chart, variant)
  }, [
    canSwitchView,
    chart,
    currentChartDisplayMode,
    isTableDisplayMode,
    switchableDataset,
    variant,
  ])
  const title = useMemo(() => {
    return getChartTitleByLabel(chart, currentChartLabel)
  }, [chart, currentChartLabel])
  const shouldRenderChartCanvas = !isTableDisplayMode && chart.data.length > 0
  const previewTitle = intl.get('dipChatKit.chartOpenPreview').d('查看大图') as string

  useEffect(() => {
    setActiveDisplayMode(resolvedInitialDisplayMode)
    setLastChartDisplayMode(resolvedChartDisplayMode)
  }, [chart.chartType, chart.plotId, resolvedChartDisplayMode, resolvedInitialDisplayMode])

  useEffect(() => {
    if (!(shouldRenderChartCanvas && chartRef.current)) return

    const chartInstance = echarts.init(chartRef.current)
    chartInstanceRef.current = chartInstance

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.resize()
    })

    resizeObserver.observe(chartRef.current)

    return () => {
      resizeObserver.disconnect()
      chartInstance.dispose()
      chartInstanceRef.current = null
    }
  }, [shouldRenderChartCanvas])

  useEffect(() => {
    if (!(shouldRenderChartCanvas && chartViewResult)) return

    chartInstanceRef.current?.setOption(chartViewResult.option, true)
    chartInstanceRef.current?.resize()
  }, [chartViewResult, shouldRenderChartCanvas])

  return (
    <>
      <div className={clsx('ChartRenderer', styles.root, className)}>
        <div
          className={clsx(
            styles.panel,
            variant === 'inline' ? styles.inlinePanel : styles.previewPanel,
          )}
        >
          <div className={clsx(styles.header, isInModal && styles.modalHeader)}>
            {!isInModal && (
              <div className={styles.headerMain}>
                <div className={styles.title}>{title}</div>
              </div>
            )}
            {!hideActions && (
              <div className={styles.headerActions}>
                {canSwitchView && (
                  <div className={styles.switcherShell}>
                    <ChartViewSwitcher
                      isInModal={isInModal}
                      className={styles.switcher}
                      activeDisplayMode={activeDisplayMode}
                      lastChartDisplayMode={switcherSelectedDisplayMode}
                      items={switcherItems}
                      onSelectChartMode={(mode) => {
                        setLastChartDisplayMode(mode)
                        setActiveDisplayMode(mode)
                      }}
                      onShowTable={() => {
                        setActiveDisplayMode('table')
                      }}
                    />
                  </div>
                )}
                {variant === 'inline' && (
                  <div className={styles.previewShell}>
                    <div className={styles.previewActions}>
                      <Tooltip title={previewTitle}>
                        <Button
                          type="text"
                          icon={<ExpandOutlined />}
                          onClick={() => {
                            setModalOpen(true)
                          }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={clsx(styles.content, isInModal && styles.modalContent)}>
            {isTableDisplayMode && switchableDataset ? (
              <div className={clsx(styles.tableWrap, isInModal && styles.modalTableWrap)}>
                <ChartDataTable
                  dataset={switchableDataset}
                  variant={isInModal ? 'modal' : 'inline'}
                />
              </div>
            ) : shouldRenderChartCanvas && chartViewResult ? (
              <div
                className={clsx(styles.canvasWrap, isInModal && styles.modalCanvasWrap)}
                style={isInModal ? undefined : { height: chartViewResult.height }}
              >
                <div ref={chartRef} className={styles.canvas} />
              </div>
            ) : (
              <div className={styles.empty}>
                {intl.get('dipChatKit.chartEmptyData').d('暂无可渲染的图表数据') as string}
              </div>
            )}
          </div>
        </div>
      </div>
      {variant === 'inline' && (
        <Modal
          open={modalOpen}
          title={<div className={styles.drawerTitle}>{title}</div>}
          closable
          centered
          maskClosable
          destroyOnHidden
          width={1200}
          styles={{ body: { padding: 0 } }}
          footer={null}
          onCancel={() => setModalOpen(false)}
        >
          <div className={styles.drawerContent}>
            <ChartRenderer
              chart={chart}
              variant="preview"
              initialDisplayMode={activeDisplayMode}
              className={styles.drawerChart}
              isInModal
            />
          </div>
        </Modal>
      )}
    </>
  )
}

export default ChartRenderer
