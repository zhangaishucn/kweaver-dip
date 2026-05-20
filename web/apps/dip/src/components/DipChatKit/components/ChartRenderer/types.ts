export type DipChatKitChartType = 'bar' | 'bar_horizontal' | 'line' | 'pie' | 'scatter'

export type DipChatKitChartDisplayMode = 'column' | 'line' | 'pie' | 'donut' | 'table'

export type DipChatKitChartOrientation = 'horizontal' | 'vertical'

export interface DipChatKitChartEncoding {
  x?: string
  y?: string
  name?: string
  value?: string
  label?: string
}

export interface DipChatKitChartDatum {
  x?: string | number
  y?: string | number
  name?: string
  value?: string | number
  label?: string
}

export interface DipChatKitChartPayload {
  plotId: string
  chartType: DipChatKitChartType
  sql: string
  encoding: DipChatKitChartEncoding
  data: DipChatKitChartDatum[]
  orientation?: DipChatKitChartOrientation
  title?: string
}

export interface DipChatKitChartDatasetRow {
  key: string
  dimension: string
  metric: number
}

export interface DipChatKitChartDataset {
  dimensionLabel: string
  metricLabel: string
  rows: DipChatKitChartDatasetRow[]
}

export interface DipChatKitChartParseOptions {
  allowLenient?: boolean
  requireRenderable?: boolean
}

export interface DipChatKitChartOptionResult {
  height: number
  option: Record<string, unknown>
}

export interface ChartRendererProps {
  chart: DipChatKitChartPayload
  className?: string
  variant?: 'inline' | 'preview'
  initialDisplayMode?: DipChatKitChartDisplayMode
  isInModal?: boolean
  hideActions?: boolean
}
