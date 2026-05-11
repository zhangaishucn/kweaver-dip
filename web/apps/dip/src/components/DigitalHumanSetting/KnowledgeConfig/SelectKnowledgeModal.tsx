import type { ModalProps } from 'antd'
import { Checkbox, Modal, Spin, Tabs, Tooltip } from 'antd'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import { type BknKnowledgeNetworkInfo, getBknKnowledgeNetworks } from '@/apis'
import AppIcon from '@/components/AppIcon'
import Empty from '@/components/Empty'
import ScrollBarContainer from '@/components/ScrollBarContainer'
import { LoadStatus } from '@/types/enums'
import { formatTimeSlash } from '@/utils/handle-function/FormatTime'
import {
  BknActionTypeOutlined,
  BknObjectTypeOutlined,
  BknRelationTypeOutlined,
} from './BknKnowledgeStatistics'

export interface SelectKnowledgeModalProps extends Omit<ModalProps, 'onCancel' | 'onOk'> {
  /** 确定成功的回调，传递信息 */
  onOk: (result: BknKnowledgeNetworkInfo[]) => void
  /** 取消回调 */
  onCancel: () => void
  /** 默认选中的知识网络 IDs */
  defaultSelectedIds?: string[]
}

/** 选择知识网络弹窗 */
const SelectKnowledgeModal = ({
  open,
  onOk,
  onCancel,
  defaultSelectedIds = [],
}: SelectKnowledgeModalProps) => {
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.Empty)
  const [knowledgeList, setKnowledgeList] = useState<BknKnowledgeNetworkInfo[]>([])
  const [selectedList, setSelectedList] = useState<BknKnowledgeNetworkInfo[]>([])

  useEffect(() => {
    setSelectedList(knowledgeList.filter((item) => defaultSelectedIds?.includes(item.id)))
  }, [knowledgeList, defaultSelectedIds])

  // 获取知识网络列表
  const fetchKnowledgeNetworks = async () => {
    if (status === LoadStatus.Loading) return // 防止重复请求
    setStatus(LoadStatus.Loading)
    try {
      const result = await getBknKnowledgeNetworks({ limit: -1, include_statistics: true })
      setKnowledgeList(result.entries)
      setStatus(result.total_count > 0 ? LoadStatus.Normal : LoadStatus.Empty)
    } catch {
      // messageApi.error(error?.description || '获取知识网络列表失败')
      setKnowledgeList([])
      setStatus(LoadStatus.Failed)
    }
  }

  useEffect(() => {
    if (open) {
      fetchKnowledgeNetworks()
    }
  }, [open])

  // 选择知识网络
  const handleSelect = (item: BknKnowledgeNetworkInfo) => {
    if (selectedList.some((selected) => selected.id === item.id)) {
      setSelectedList(selectedList.filter((selected) => selected.id !== item.id))
    } else {
      setSelectedList([...selectedList, item])
    }
  }

  // 确定
  const handleOk = () => {
    onOk(selectedList)
    onCancel()
  }

  const renderStateContent = () => {
    if (status === LoadStatus.Loading) {
      return <Spin />
    }

    if (status === LoadStatus.Failed) {
      return <Empty type="failed" title={intl.get('digitalHuman.knowledgeModal.loadFailed')} />
    }

    if (status === LoadStatus.Empty) {
      return <Empty title={intl.get('digitalHuman.knowledgeModal.emptyNoKnowledge')} />
    }

    return null
  }

  const renderKnowledgeList = () => {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {knowledgeList.map((item) => {
          const isSelected = selectedList.some((selected) => selected.id === item.id)
          return (
            <button
              key={item.id}
              type="button"
              className={clsx(
                'relative flex h-[145px] flex-col rounded-[10px] border border-[rgba(0,0,0,0.1)] bg-white px-4 py-4 text-left outline-none transition-colors hover:bg-[rgba(0,0,0,0.02)]',
                isSelected &&
                  '!border-[--dip-primary-color] !bg-[rgba(18,110,227,0.06)] !hover:bg-[rgba(18,110,227,0.1)]',
              )}
              onClick={() => handleSelect(item)}
            >
              <Checkbox
                className="absolute right-4 top-[19px]"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => handleSelect(item)}
              />
              <div className="flex gap-x-3 pr-6">
                <div className="flex h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
                  <AppIcon
                    icon={item.icon}
                    name={item.name}
                    size={48}
                    className="w-full h-full"
                    shape="square"
                    color={item.color}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="min-w-0 truncate text-sm font-medium leading-[22px] text-[--dip-text-color-85]"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <div
                    className="mt-2 line-clamp-2 text-xs font-normal leading-5 text-[--dip-text-color-85]"
                    title={item.comment}
                  >
                    {item.comment?.trim() || intl.get('global.notDes')}
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <div className="mb-2 h-px bg-[--dip-line-color-10]" />
                <div className="flex items-center justify-between gap-2 text-xs font-normal leading-6 text-[--dip-text-color-65]">
                  <div className="flex min-w-0 items-center gap-3">
                    <StatisticItem
                      icon={<BknObjectTypeOutlined size={14} />}
                      tooltip="对象类"
                      value={item.statistics?.object_types_total}
                    />
                    <StatisticItem
                      icon={<BknRelationTypeOutlined size={14} />}
                      tooltip="关系类"
                      value={item.statistics?.relation_types_total}
                    />
                    <StatisticItem
                      icon={<BknActionTypeOutlined size={14} />}
                      tooltip="行动类"
                      value={item.statistics?.action_types_total}
                    />
                  </div>
                  <div className="min-w-0 truncate text-right">
                    {intl.get('digitalHuman.knowledgeModal.updatedPrefix')}
                    {formatTimeSlash(item.update_time || '') || '--'}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderContent = () => {
    const stateContent = renderStateContent()

    if (stateContent) {
      return <div className="absolute inset-0 flex items-center justify-center">{stateContent}</div>
    }

    return renderKnowledgeList()
  }

  return (
    <Modal
      title={intl.get('digitalHuman.knowledgeModal.title')}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      closable
      centered
      mask={{ closable: false }}
      destroyOnHidden
      width={744}
      okText={intl.get('global.ok')}
      cancelText={intl.get('global.cancel')}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          <OkBtn />
          <CancelBtn />
        </>
      )}
    >
      <div className="flex flex-col">
        {/* <AiPromptInput
            employeeOptions={[]}
            placeholder="可以直接输入你想要创建的业务知识网络，也可以直接选择下方的业务知识网络"
            onSubmit={handleSubmit}
            autoSize={{ minRows: 2, maxRows: 2 }}
          /> */}
        <Tabs
          size="small"
          items={[
            {
              key: 'all',
              label: intl.get('digitalHuman.knowledgeModal.tabAllNetworks'),
            },
          ]}
          activeKey="all"
        />
        <ScrollBarContainer className="mx-[-24px] px-6">
          <div className="flex-1 grid max-h-[400px] overflow-y-auto relative min-h-[180px]">
            {renderContent()}
          </div>
        </ScrollBarContainer>
      </div>
    </Modal>
  )
}

const StatisticItem = ({
  icon,
  tooltip,
  value,
}: {
  icon: React.ReactNode
  tooltip: string
  value?: number
}) => (
  <span className="inline-flex items-center gap-0.5 text-[--dip-text-color-65]">
    <Tooltip title={tooltip}>
      <span className="inline-flex text-[14px]">{icon}</span>
    </Tooltip>
    <span>{value ?? 0}</span>
  </span>
)

export default SelectKnowledgeModal
