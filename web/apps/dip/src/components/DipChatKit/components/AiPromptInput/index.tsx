import { CloseCircleFilled, SendOutlined } from '@ant-design/icons'
import { FileCard, Sender, type SenderProps } from '@ant-design/x'
import {
  Avatar,
  Button,
  Col,
  Dropdown,
  Flex,
  type GetRef,
  type MenuProps,
  message,
  Row,
  Tag,
  Tooltip,
  Upload,
} from 'antd'
import clsx from 'clsx'
import uniq from 'lodash/uniq'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import intl from 'react-intl-universal'
import IconFont from '@/components/IconFont'
import ResizeObserver from '@/components/ResizeObserver'
import useResizeObserver from '@/hooks/useResizeObserver'
import { getChannelUserList, getDigitalHumanList } from '../../apis'
import type { DipChatKitChannelUser } from '../../apis/types'
import { formatChannelMentionLabel, formatChannelTypeLabel } from '../ChannelMention/utils'
import styles from './index.module.less'
import type {
  AiPromptInputProps,
  AiPromptMentionOption,
  AiPromptSubmitPayload,
  CursorAnchorPosition,
} from './types'
import {
  filterMentionOptionsByQuery,
  getAttachmentFileKey,
  getContentEditableCaretPosition,
  getContentEditableTextBeforeCursor,
  getRawUploadFile,
  getTextAreaCaretPosition,
  mergeAttachmentFiles,
  parseTriggerQueryBeforeCursor,
  validateAttachmentFiles,
} from './utils'

const mentionAvatarColors = [
  { bg: '#EEF2FF', fg: '#4F46E5' },
  { bg: '#FFF7ED', fg: '#EA580C' },
  { bg: '#ECFDF5', fg: '#16A34A' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
  { bg: '#EFF6FF', fg: '#0284C7' },
  { bg: '#FFF1F2', fg: '#E11D48' },
]

const getInitial = (label: string) => label.trim().charAt(0) || ''
const uploadValidateMessageKey = 'ai-prompt-upload-validate'
const employeeSlotKey = 'ai_prompt_input_employee_slot'
const channelUserPageSize = 200
const channelUserCollapsedCount = 5
const channelUserOptionPrefix = 'channel_user'
const channelGroupActionPrefix = 'channel_group_action'
const caretPlaceholder = '\u200b'

type SenderSlotItem = NonNullable<SenderProps['slotConfig']>[number]
const emptySenderSlotConfig: NonNullable<SenderProps['slotConfig']> = []

type CaretSnapshot =
  | {
      type: 'textarea'
      start: number
      end: number
    }
  | {
      type: 'contentEditable'
      range: Range
    }

const sanitizeEditorValue = (inputValue: string): string => {
  return inputValue.replace(/\u200b/g, '')
}

const createChannelUserOptionValue = (channelType: string, userId: string): string => {
  return `${channelUserOptionPrefix}:${channelType}:${userId}`
}

const createChannelMentionPayload = (option: AiPromptMentionOption): string => {
  return `@{channel:${option.channelType}:user:${option.displayName}:${option.userId}}`
}

const getMentionOptionLabel = (option: AiPromptMentionOption): string => {
  if (option.kind === 'channelUser' && option.channelType && option.displayName) {
    return formatChannelMentionLabel(option.channelType, option.displayName)
  }
  return option.label
}

const toChannelUserOption = (item: DipChatKitChannelUser): AiPromptMentionOption | null => {
  const channelType = item.channel?.type?.trim()
  const userId = item.channel?.user_id?.trim()
  const displayName = item.displayName?.trim()
  if (!(channelType && userId && displayName)) return null

  return {
    kind: 'channelUser',
    value: createChannelUserOptionValue(channelType, userId),
    label: displayName,
    displayName,
    channelType,
    userId,
  }
}

const AiPromptInput: React.FC<AiPromptInputProps> = ({
  value,
  defaultValue = '',
  assignEmployeeValue,
  defaultEmployeeValue,
  autoSize = { minRows: 2, maxRows: 4 },
  onChange,
  onSubmit,
  onStop,
  onAttach,
  onEmployeeSelect,
  employeeOptions = [],
  placeholder,
  employeeButtonLabel,
  attachButtonTitle,
  sendButtonTitle,
  triggerCharacter = false,
  disabled = false,
  loading = false,
  className,
}) => {
  const senderRef = useRef<GetRef<typeof Sender>>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const keyboardOpenRafRef = useRef<number | null>(null)
  const rebuildVersionRef = useRef(0)
  const isRebuildingContentRef = useRef(false)
  const suppressNextSubmitRef = useRef(false)
  const caretSnapshotRef = useRef<CaretSnapshot | null>(null)
  const isMentionMenuMouseDownRef = useRef(false)
  const latestTextValueRef = useRef(defaultValue)
  const [buttonMentionOpen, setButtonMentionOpen] = useState(false)
  const [keyboardMentionOpen, setKeyboardMentionOpen] = useState(false)
  const [activeKeyboardCharacter, setActiveKeyboardCharacter] = useState<string | null>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [keyboardActiveIndex, setKeyboardActiveIndex] = useState(-1)
  const [cursorAnchor, setCursorAnchor] = useState<CursorAnchorPosition>({ left: 0, top: 0 })
  const [innerValue, setInnerValue] = useState(defaultValue)
  const [attachments, setAttachments] = useState<File[]>([])
  const [fileColSpan, setFileColSpan] = useState(6)
  const [employees, setEmployees] = useState<AiPromptMentionOption[]>([])
  const [fetchedEmployeeOptions, setFetchedEmployeeOptions] = useState<AiPromptMentionOption[]>([])
  const [channelUserOptions, setChannelUserOptions] = useState<AiPromptMentionOption[]>([])
  const [expandedChannelTypes, setExpandedChannelTypes] = useState<string[]>([])

  const mergedValue = value ?? innerValue
  const normalizedMergedValue = sanitizeEditorValue(mergedValue)
  const canEdit = !disabled
  const canSubmit = !(disabled || loading)
  const normalizedAssignEmployeeValue = assignEmployeeValue?.trim() || ''
  const showEmployeeSelector = !normalizedAssignEmployeeValue
  const resolvedEmployeeButtonLabel = employeeButtonLabel ?? intl.get('aiPromptInput.mentionButton')
  const resolvedMentionButtonLabel = intl
    .get('aiPromptInput.mentionObjectButton')
    .d(resolvedEmployeeButtonLabel)
  const resolvedAttachButtonTitle = attachButtonTitle ?? intl.get('aiPromptInput.attach')
  const resolvedSendButtonTitle = sendButtonTitle ?? intl.get('aiPromptInput.send')
  const resolvedStopButtonTitle = intl.get('dipChatKit.stopGenerate').d('鍋滄鐢熸垚')
  const resolvedRemoveFileTitle = intl.get('aiPromptInput.removeFile')
  const resolvedEmployeeOptions = useMemo(() => {
    const withKind = (options: AiPromptMentionOption[]) =>
      options.map((item) => ({
        ...item,
        kind: item.kind ?? ('employee' as const),
      }))

    if (employeeOptions.length > 0) {
      return withKind(employeeOptions)
    }
    return withKind(fetchedEmployeeOptions)
  }, [employeeOptions, fetchedEmployeeOptions])

  useEffect(() => {
    if (value !== undefined) {
      setInnerValue(value)
      latestTextValueRef.current = value
    }
  }, [value])

  useEffect(() => {
    let disposed = false

    if (employeeOptions.length > 0) {
      setFetchedEmployeeOptions([])
      return () => {
        disposed = true
      }
    }

    const loadDigitalHumanList = async () => {
      try {
        const list = await getDigitalHumanList()
        if (disposed) return

        const options = list
          .filter((item) => item.id && item.name)
          .map((item) => ({
            value: item.id,
            label: item.name,
          }))
        setFetchedEmployeeOptions(options)
      } catch {
        if (disposed) return
        setFetchedEmployeeOptions([])
        message.error(
          intl
            .get('dipChatKit.fetchDigitalHumanListFailed')
            .d('鑾峰彇鏁板瓧鍛樺伐鍒楄〃澶辫触锛岃绋嶅悗閲嶈瘯'),
        )
      }
    }

    void loadDigitalHumanList()

    return () => {
      disposed = true
    }
  }, [employeeOptions.length])

  useEffect(() => {
    if (normalizedAssignEmployeeValue) {
      const assignedEmployee = resolvedEmployeeOptions.find(
        (item) => item.value === normalizedAssignEmployeeValue,
      ) ?? {
        value: normalizedAssignEmployeeValue,
        label: normalizedAssignEmployeeValue,
      }
      setEmployees([assignedEmployee])
      return
    }

    if (!(defaultEmployeeValue && resolvedEmployeeOptions.length)) return
    setEmployees((prevEmployees) => {
      if (prevEmployees.length > 0) return prevEmployees
      const defaultEmployee = resolvedEmployeeOptions.find(
        (item) => item.value === defaultEmployeeValue,
      )
      if (!defaultEmployee) return prevEmployees
      return [defaultEmployee]
    })
  }, [defaultEmployeeValue, normalizedAssignEmployeeValue, resolvedEmployeeOptions])

  const buttonMentionOptionMap = useMemo(() => {
    return new Map(resolvedEmployeeOptions.map((item) => [item.value, item]))
  }, [resolvedEmployeeOptions])

  const selectedEmployee = employees[0]
  const selectedEmployeeKey = selectedEmployee?.value ?? ''
  const channelUserOptionMap = useMemo(() => {
    return new Map(channelUserOptions.map((item) => [item.value, item]))
  }, [channelUserOptions])
  const useMentionSlotMode = showEmployeeSelector || channelUserOptions.length > 0

  const atMentionOptions = useMemo(() => {
    if (!showEmployeeSelector) {
      return channelUserOptions
    }
    return selectedEmployeeKey ? channelUserOptions : resolvedEmployeeOptions
  }, [channelUserOptions, resolvedEmployeeOptions, selectedEmployeeKey, showEmployeeSelector])

  useEffect(() => {
    let disposed = false

    const loadChannelUsers = async () => {
      try {
        const params = { start: 0, limit: channelUserPageSize }
        const result = await getChannelUserList(params)

        if (disposed) return

        const options = (result.items ?? [])
          .map(toChannelUserOption)
          .filter((item): item is AiPromptMentionOption => Boolean(item))
        setChannelUserOptions(options)
      } catch {
        if (disposed) return
        setChannelUserOptions([])
        message.error(
          intl.get('dipChatKit.fetchChannelUserListFailed').d('获取通道用户列表失败，请稍后重试'),
        )
      }
    }

    void loadChannelUsers()

    return () => {
      disposed = true
    }
  }, [])

  const keyboardTriggerItems = useMemo(() => {
    const items = Array.isArray(triggerCharacter)
      ? triggerCharacter.filter((item) => item.character)
      : []

    if (showEmployeeSelector || channelUserOptions.length > 0) {
      items.push({
        character: '@',
        options: atMentionOptions,
      })
    }

    return items
  }, [atMentionOptions, channelUserOptions.length, showEmployeeSelector, triggerCharacter])

  const keyboardTriggerCharacters = useMemo(() => {
    return keyboardTriggerItems.map((item) => item.character)
  }, [keyboardTriggerItems])

  const keyboardTriggerOptionMap = useMemo(() => {
    return new Map(keyboardTriggerItems.map((item) => [item.character, item.options]))
  }, [keyboardTriggerItems])

  const keyboardMentionBaseOptions = useMemo(() => {
    if (!activeKeyboardCharacter) return []
    return keyboardTriggerOptionMap.get(activeKeyboardCharacter) ?? []
  }, [activeKeyboardCharacter, keyboardTriggerOptionMap])

  const keyboardResizeTarget =
    keyboardMentionOpen && senderRef.current?.inputElement instanceof HTMLElement
      ? senderRef.current.inputElement
      : null

  const keyboardMentionOptions = useMemo(() => {
    return filterMentionOptionsByQuery(keyboardMentionBaseOptions, mentionQuery)
  }, [keyboardMentionBaseOptions, mentionQuery])

  const createSwitchableMentionSlotItem = useCallback(
    (item: AiPromptMentionOption): SenderSlotItem => {
      const isChannelUser = item.kind === 'channelUser'
      const slotKey = isChannelUser ? `mention_${item.value}_${Date.now()}` : employeeSlotKey
      const optionMap = isChannelUser ? channelUserOptionMap : buttonMentionOptionMap
      const menuOptions = isChannelUser ? channelUserOptions : resolvedEmployeeOptions
      const color = mentionAvatarColors[0]

      return {
        type: 'custom',
        key: slotKey,
        props: {
          defaultValue: item.value,
          employeeValue: isChannelUser ? undefined : item.value,
          mentionKind: item.kind ?? 'employee',
        },
        formatResult: (slotValue) => {
          const valueKey = String(slotValue || item.value)
          const currentOption = optionMap.get(valueKey) ?? item
          if (currentOption.kind === 'channelUser') {
            return createChannelMentionPayload(currentOption)
          }
          return ''
        },
        customRender: (slotValue, onSlotChange) => {
          const valueKey = String(slotValue || item.value)
          const currentOption = optionMap.get(valueKey) ?? item
          const label = getMentionOptionLabel(currentOption)
          const menu: MenuProps = {
            items: menuOptions.map((option, index) => buildSuggestionOptionItem(option, index)),
            selectable: true,
            selectedKeys: [currentOption.value],
            onClick: ({ key, domEvent }) => {
              domEvent.preventDefault()
              domEvent.stopPropagation()
              const nextOption = menuOptions.find((option) => option.value === String(key))
              if (!nextOption) return

              if (isChannelUser) {
                onSlotChange(nextOption.value)
                return
              }

              onEmployeeSelect?.(nextOption)
              setEmployees([nextOption])
            },
          }

          const tag = (
            <Tag
              className={clsx(styles.employeeSlotTag, styles.switchableMentionTag)}
              onMouseDown={(event) => {
                event.preventDefault()
              }}
            >
              <span className={styles.employeeSlotTagContent}>
                <span className={styles.employeeSlotTagAvatar}>
                  {currentOption.avatar ?? (
                    <Avatar
                      size={18}
                      style={{
                        backgroundColor: color.bg,
                        color: color.fg,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {getInitial(currentOption.displayName ?? currentOption.label)}
                    </Avatar>
                  )}
                </span>
                <span className={styles.employeeSlotTagLabel}>{label}</span>
              </span>
            </Tag>
          )

          if (!canEdit || menuOptions.length <= 1) {
            return tag
          }

          return (
            <Dropdown
              trigger={['click']}
              placement="bottomLeft"
              destroyOnHidden
              menu={menu}
              popupRender={renderMentionPopup}
            >
              {tag}
            </Dropdown>
          )
        },
      }
    },
    [
      buttonMentionOptionMap,
      canEdit,
      channelUserOptionMap,
      channelUserOptions,
      onEmployeeSelect,
      resolvedEmployeeOptions,
    ],
  )

  const rebuildSenderContent = useCallback(
    (nextContent: string, nextEmployee?: AiPromptMentionOption) => {
      const senderInstance = senderRef.current
      if (!senderInstance) return

      latestTextValueRef.current = sanitizeEditorValue(nextContent)

      const insertItems: SenderSlotItem[] = []
      if (showEmployeeSelector && nextEmployee) {
        insertItems.push(createSwitchableMentionSlotItem(nextEmployee))
      }
      if (nextContent) {
        insertItems.push({
          type: 'text',
          value: nextContent,
        })
      }

      const currentVersion = rebuildVersionRef.current + 1
      rebuildVersionRef.current = currentVersion
      isRebuildingContentRef.current = true

      senderInstance.clear?.()
      if (insertItems.length) {
        senderInstance.insert?.(insertItems, 'start', undefined, true)
      }

      requestAnimationFrame(() => {
        if (rebuildVersionRef.current !== currentVersion) return
        isRebuildingContentRef.current = false
      })
    },
    [createSwitchableMentionSlotItem, showEmployeeSelector],
  )

  function buildSuggestionOptionItem(
    item: AiPromptMentionOption,
    index: number,
  ): NonNullable<MenuProps['items']>[number] {
    const color = mentionAvatarColors[index % mentionAvatarColors.length]
    const label = getMentionOptionLabel(item)
    return {
      key: item.value,
      label: (
        <span className={styles.mentionMenuItem}>
          <span className={styles.mentionIcon}>
            {item.avatar ?? (
              <Avatar
                size={24}
                style={{
                  backgroundColor: color.bg,
                  color: color.fg,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {getInitial(item.displayName ?? item.label)}
              </Avatar>
            )}
          </span>
          <Tooltip title={label} placement="right">
            <span className={styles.mentionMenuLabel}>{label}</span>
          </Tooltip>
        </span>
      ),
    }
  }

  const groupChannelOptions = (options: AiPromptMentionOption[]) => {
    const groups = new Map<string, AiPromptMentionOption[]>()
    for (const option of options) {
      if (option.kind !== 'channelUser' || !option.channelType) continue
      const current = groups.get(option.channelType) ?? []
      current.push(option)
      groups.set(option.channelType, current)
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right))
  }

  const getVisibleMentionOptions = (options: AiPromptMentionOption[]): AiPromptMentionOption[] => {
    const employeeOptions = options.filter((item) => item.kind !== 'channelUser')
    const visibleChannelOptions = groupChannelOptions(options).flatMap(([channelType, items]) => {
      if (expandedChannelTypes.includes(channelType) || items.length <= channelUserCollapsedCount) {
        return items
      }
      return items.slice(0, channelUserCollapsedCount)
    })
    return [...employeeOptions, ...visibleChannelOptions]
  }

  const buildSuggestionItems = (
    options: AiPromptMentionOption[],
  ): NonNullable<MenuProps['items']> => {
    const items: NonNullable<MenuProps['items']> = []
    const employeeOptions = options.filter((item) => item.kind !== 'channelUser')

    if (employeeOptions.length > 0) {
      items.push({
        type: 'group',
        key: 'mention_group_employee',
        label: intl.get('aiPromptInput.employeeMentionGroup').d('我的数字员工'),
        children: employeeOptions.map((item, index) => buildSuggestionOptionItem(item, index)),
      })
    }

    groupChannelOptions(options).forEach(([channelType, groupOptions], groupIndex) => {
      const expanded = expandedChannelTypes.includes(channelType)
      const visibleOptions =
        expanded || groupOptions.length <= channelUserCollapsedCount
          ? groupOptions
          : groupOptions.slice(0, channelUserCollapsedCount)
      const children: NonNullable<MenuProps['items']> = visibleOptions.map((item, index) =>
        buildSuggestionOptionItem(item, employeeOptions.length + groupIndex + index),
      )

      if (groupOptions.length > channelUserCollapsedCount) {
        children.push({
          key: `${channelGroupActionPrefix}:${channelType}`,
          label: (
            <span className={styles.mentionMoreAction}>
              {expanded
                ? intl.get('aiPromptInput.collapseMentionGroup').d('收起')
                : intl.get('aiPromptInput.expandMentionGroup').d('查看更多')}
            </span>
          ),
        })
      }

      items.push({
        type: 'group',
        key: `mention_group_channel_${channelType}`,
        label: formatChannelTypeLabel(channelType),
        children,
      })
    })

    return items
  }

  const buttonSuggestionItems = useMemo(() => {
    return buildSuggestionItems(atMentionOptions)
  }, [atMentionOptions, expandedChannelTypes])

  const visibleKeyboardMentionOptions = useMemo(() => {
    return getVisibleMentionOptions(keyboardMentionOptions)
  }, [expandedChannelTypes, keyboardMentionOptions])

  const keyboardActiveOption = visibleKeyboardMentionOptions[keyboardActiveIndex]
  const keyboardActiveKey = keyboardActiveOption?.value

  const keyboardMentionOptionMap = useMemo(() => {
    return new Map(visibleKeyboardMentionOptions.map((item) => [item.value, item]))
  }, [visibleKeyboardMentionOptions])

  const keyboardSuggestionItems = useMemo(() => {
    return buildSuggestionItems(keyboardMentionOptions)
  }, [expandedChannelTypes, keyboardMentionOptions])

  const clearAnchorRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const clearKeyboardOpenRaf = () => {
    if (keyboardOpenRafRef.current !== null) {
      cancelAnimationFrame(keyboardOpenRafRef.current)
      keyboardOpenRafRef.current = null
    }
  }

  const getCursorAnchorPosition = (): CursorAnchorPosition | null => {
    const inputElement = senderRef.current?.inputElement
    if (!(inputElement instanceof HTMLElement && cardRef.current)) return null

    if (inputElement instanceof HTMLTextAreaElement) {
      const cursorIndex = inputElement.selectionStart ?? inputElement.value.length
      const caretPosition = getTextAreaCaretPosition(inputElement, cursorIndex)
      const textAreaRect = inputElement.getBoundingClientRect()
      const cardRect = cardRef.current.getBoundingClientRect()

      const left = textAreaRect.left - cardRect.left + caretPosition.left
      const top = textAreaRect.top - cardRect.top + caretPosition.top

      return {
        left: Math.max(left, 8),
        top: Math.max(top, 8),
      }
    }

    return getContentEditableCaretPosition(inputElement, cardRef.current)
  }

  const updateCursorAnchorPosition = () => {
    const nextPosition = getCursorAnchorPosition()
    if (!nextPosition) return
    setCursorAnchor(nextPosition)
  }

  const scheduleCursorAnchorPosition = () => {
    clearAnchorRaf()
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateCursorAnchorPosition()
    })
  }

  const openMentionPanel = () => {
    if (!canEdit) return
    if (!buttonSuggestionItems.length) return
    captureCaretSnapshot()
    clearKeyboardOpenRaf()
    setActiveKeyboardCharacter(null)
    setMentionQuery('')
    setKeyboardMentionOpen(false)
    setButtonMentionOpen(true)
  }

  const closeKeyboardMentionPanel = () => {
    clearKeyboardOpenRaf()
    setKeyboardMentionOpen(false)
    setActiveKeyboardCharacter(null)
    setMentionQuery('')
    setKeyboardActiveIndex(-1)
  }

  const openKeyboardMentionPanel = () => {
    clearKeyboardOpenRaf()
    updateCursorAnchorPosition()

    if (keyboardMentionOpen) {
      scheduleCursorAnchorPosition()
      return
    }

    setButtonMentionOpen(false)
    keyboardOpenRafRef.current = requestAnimationFrame(() => {
      keyboardOpenRafRef.current = null
      setKeyboardMentionOpen(true)
    })
  }

  const closeMentionPanel = () => {
    setButtonMentionOpen(false)
    closeKeyboardMentionPanel()
    isMentionMenuMouseDownRef.current = false
  }

  const suppressSubmitForCurrentFrame = () => {
    suppressNextSubmitRef.current = true
    requestAnimationFrame(() => {
      suppressNextSubmitRef.current = false
    })
  }

  const captureCaretSnapshot = () => {
    caretSnapshotRef.current = null
    const inputElement = senderRef.current?.inputElement
    if (!(inputElement instanceof HTMLElement)) {
      return
    }

    if (inputElement instanceof HTMLTextAreaElement) {
      const nextStart = inputElement.selectionStart ?? inputElement.value.length
      const nextEnd = inputElement.selectionEnd ?? nextStart
      caretSnapshotRef.current = {
        type: 'textarea',
        start: nextStart,
        end: nextEnd,
      }
      return
    }

    const selection = window.getSelection()
    if (!(selection && selection.rangeCount > 0)) return

    const range = selection.getRangeAt(0)
    if (!inputElement.contains(range.startContainer)) return

    caretSnapshotRef.current = {
      type: 'contentEditable',
      range: range.cloneRange(),
    }
  }

  const restoreCaretSnapshot = () => {
    const snapshot = caretSnapshotRef.current
    caretSnapshotRef.current = null
    const inputElement = senderRef.current?.inputElement
    if (!(snapshot && inputElement instanceof HTMLElement)) {
      senderRef.current?.focus?.()
      return
    }

    senderRef.current?.focus?.()
    requestAnimationFrame(() => {
      if (!(senderRef.current?.inputElement instanceof HTMLElement)) return

      if (snapshot.type === 'textarea' && inputElement instanceof HTMLTextAreaElement) {
        const textLength = inputElement.value.length
        const start = Math.min(snapshot.start, textLength)
        const end = Math.min(snapshot.end, textLength)
        inputElement.setSelectionRange(start, end)
        return
      }

      if (snapshot.type === 'contentEditable') {
        if (
          !(
            snapshot.range.startContainer.isConnected &&
            snapshot.range.endContainer.isConnected &&
            inputElement.contains(snapshot.range.startContainer) &&
            inputElement.contains(snapshot.range.endContainer)
          )
        ) {
          normalizeCaretAfterEmployeeSlot()
          return
        }
        const selection = window.getSelection()
        if (!selection) return
        selection.removeAllRanges()
        selection.addRange(snapshot.range)
      }
    })
  }

  const restoreCaretSnapshotImmediately = () => {
    const snapshot = caretSnapshotRef.current
    const inputElement = senderRef.current?.inputElement
    if (!(snapshot && inputElement instanceof HTMLElement)) return false

    senderRef.current?.focus?.()

    if (snapshot.type === 'textarea' && inputElement instanceof HTMLTextAreaElement) {
      const textLength = inputElement.value.length
      const start = Math.min(snapshot.start, textLength)
      const end = Math.min(snapshot.end, textLength)
      inputElement.setSelectionRange(start, end)
      return true
    }

    if (snapshot.type === 'contentEditable') {
      if (
        !(
          snapshot.range.startContainer.isConnected &&
          snapshot.range.endContainer.isConnected &&
          inputElement.contains(snapshot.range.startContainer) &&
          inputElement.contains(snapshot.range.endContainer)
        )
      ) {
        return false
      }

      const selection = window.getSelection()
      if (!selection) return false
      selection.removeAllRanges()
      selection.addRange(snapshot.range)
      return true
    }

    return false
  }

  const normalizeCaretAfterEmployeeSlot = () => {
    requestAnimationFrame(() => {
      if (!showEmployeeSelector) return

      const inputElement = senderRef.current?.inputElement
      if (!(inputElement instanceof HTMLElement)) return
      if (inputElement instanceof HTMLTextAreaElement) return

      const slotNode = inputElement.querySelector(`[data-slot-key="${employeeSlotKey}"]`)
      if (!slotNode) return

      const currentContent = sanitizeEditorValue(
        senderRef.current?.getValue?.().value ?? latestTextValueRef.current,
      )
      if (currentContent.length > 0) return

      placeCaretAfterEmployeeSlot()
    })
  }

  const placeCaretAfterEmployeeSlot = () => {
    senderRef.current?.focus?.()

    requestAnimationFrame(() => {
      const inputElement = senderRef.current?.inputElement
      if (!(inputElement instanceof HTMLElement)) return
      if (inputElement instanceof HTMLTextAreaElement) return

      const selection = window.getSelection()
      if (!selection) return

      const slotNode = inputElement.querySelector(`[data-slot-key="${employeeSlotKey}"]`)
      const range = document.createRange()

      if (slotNode?.parentNode) {
        const nextSibling = slotNode.nextSibling
        let caretAnchor: Text
        let caretOffset = 0

        if (nextSibling?.nodeType === Node.TEXT_NODE) {
          caretAnchor = nextSibling as Text
          if (!caretAnchor.data.length) {
            caretAnchor.data = caretPlaceholder
            caretOffset = 1
          }
        } else {
          caretAnchor = document.createTextNode(caretPlaceholder)
          slotNode.parentNode.insertBefore(caretAnchor, nextSibling ?? null)
          caretOffset = 1
        }

        range.setStart(caretAnchor, caretOffset)
        range.collapse(true)
      } else {
        range.selectNodeContents(inputElement)
        range.collapse(false)
      }

      selection.removeAllRanges()
      selection.addRange(range)
    })
  }

  const handleFileChange = (fileList: File[]) => {
    setAttachments((prev) => {
      const { validFiles, errorMessages } = validateAttachmentFiles(fileList, prev)
      const deduplicatedErrorMessages = uniq(errorMessages)

      if (deduplicatedErrorMessages.length) {
        message.error({
          key: uploadValidateMessageKey,
          content: deduplicatedErrorMessages.join('；'),
        })
      } else {
        message.destroy(uploadValidateMessageKey)
      }

      if (!validFiles.length) {
        return prev
      }

      const next = mergeAttachmentFiles(prev, validFiles)
      onAttach?.(next)
      return next
    })
  }

  const handleAttachmentRemove = (fileKey: string) => {
    setAttachments((prev) => {
      const next = prev.filter((item) => getAttachmentFileKey(item) !== fileKey)
      onAttach?.(next)
      return next
    })
  }

  const clearAttachments = () => {
    setAttachments([])
    onAttach?.([])
  }

  const handleSubmit: NonNullable<SenderProps['onSubmit']> = (content) => {
    if (suppressNextSubmitRef.current) {
      suppressNextSubmitRef.current = false
      return
    }

    const nextContent = sanitizeEditorValue(content).trim()
    const hasContentOrFiles = Boolean(nextContent || attachments.length)
    if (!(hasContentOrFiles && canSubmit)) {
      return
    }

    const slotConfigFromSender = senderRef.current?.getValue?.().slotConfig
    const slotEmployee = (() => {
      const slot = slotConfigFromSender?.find((item) => item.key === employeeSlotKey)
      if (!(slot && 'props' in slot)) return undefined

      const slotEmployeeValue =
        (slot.props as { employeeValue?: string } | undefined)?.employeeValue?.trim() ?? ''
      if (!slotEmployeeValue) return undefined

      return (
        buttonMentionOptionMap.get(slotEmployeeValue) ?? {
          value: slotEmployeeValue,
          label: slotEmployeeValue,
        }
      )
    })()

    const submitEmployees =
      employees.length > 0
        ? employees
        : slotEmployee
          ? [slotEmployee]
          : normalizedAssignEmployeeValue
            ? [{ value: normalizedAssignEmployeeValue, label: normalizedAssignEmployeeValue }]
            : []

    if (!submitEmployees.length) {
      message.warning(intl.get('dipChatKit.selectDigitalHumanFirst').d('请先选择一个数字员工'))
      return
    }

    const payload: AiPromptSubmitPayload = {
      content: nextContent,
      employees: submitEmployees,
      files: attachments,
    }

    onSubmit?.(payload)

    if (value === undefined) {
      setInnerValue('')
      latestTextValueRef.current = ''
    } else {
      onChange?.('')
    }

    clearAttachments()
    rebuildSenderContent('', selectedEmployee)
    closeMentionPanel()
  }

  const removeLastTriggerText = (content: string, triggerText: string): string => {
    if (!triggerText) return content
    const index = content.lastIndexOf(triggerText)
    if (index < 0) return content
    return `${content.slice(0, index)}${content.slice(index + triggerText.length)}`
  }

  const handleMentionSelect = (option: AiPromptMentionOption, source: 'button' | 'keyboard') => {
    if (!canEdit) return

    const isEmployeeSelection =
      option.kind !== 'channelUser' && buttonMentionOptionMap.has(option.value)

    if (!isEmployeeSelection) {
      const mentionCharacter = activeKeyboardCharacter ?? '@'
      const replaceText = source === 'keyboard' ? `${mentionCharacter}${mentionQuery}` : undefined
      if (replaceText) {
        restoreCaretSnapshotImmediately()
      }
      senderRef.current?.insert?.([createSwitchableMentionSlotItem(option)], 'cursor', replaceText)
      caretSnapshotRef.current = null
      closeMentionPanel()
      senderRef.current?.focus?.()
      return
    }

    onEmployeeSelect?.(option)

    if (source === 'keyboard') {
      const mentionCharacter = activeKeyboardCharacter ?? '@'
      const replaceText = `${mentionCharacter}${mentionQuery}`
      const currentContent = sanitizeEditorValue(
        senderRef.current?.getValue?.().value ?? latestTextValueRef.current,
      )
      const nextContent = removeLastTriggerText(currentContent, replaceText)
      setEmployees([option])
      rebuildSenderContent(nextContent, option)
      closeMentionPanel()
      senderRef.current?.focus?.()
      normalizeCaretAfterEmployeeSlot()
      return
    }

    const currentContent = sanitizeEditorValue(
      senderRef.current?.getValue?.().value ?? latestTextValueRef.current,
    )
    setEmployees([option])
    rebuildSenderContent(currentContent, option)

    closeMentionPanel()
    restoreCaretSnapshot()
    normalizeCaretAfterEmployeeSlot()
  }

  const handleButtonMentionMenuClick: MenuProps['onClick'] = ({ key }) => {
    const clickedKey = String(key)
    if (clickedKey.startsWith(`${channelGroupActionPrefix}:`)) {
      const channelType = clickedKey.slice(channelGroupActionPrefix.length + 1)
      setExpandedChannelTypes((prev) =>
        prev.includes(channelType)
          ? prev.filter((item) => item !== channelType)
          : [...prev, channelType],
      )
      return
    }

    if (clickedKey === selectedEmployeeKey) {
      closeMentionPanel()
      restoreCaretSnapshot()
      normalizeCaretAfterEmployeeSlot()
      return
    }

    const option = atMentionOptions.find((item) => item.value === clickedKey)
    if (!option) return
    handleMentionSelect(option, 'button')
  }

  const handleKeyboardMentionMenuClick: MenuProps['onClick'] = ({ key }) => {
    const clickedKey = String(key)
    if (clickedKey.startsWith(`${channelGroupActionPrefix}:`)) {
      const channelType = clickedKey.slice(channelGroupActionPrefix.length + 1)
      setExpandedChannelTypes((prev) =>
        prev.includes(channelType)
          ? prev.filter((item) => item !== channelType)
          : [...prev, channelType],
      )
      return
    }

    const isKeyboardEmployeeMenu = showEmployeeSelector && activeKeyboardCharacter === '@'
    if (isKeyboardEmployeeMenu && clickedKey === selectedEmployeeKey) {
      closeMentionPanel()
      restoreCaretSnapshot()
      normalizeCaretAfterEmployeeSlot()
      return
    }

    const option = keyboardMentionOptionMap.get(clickedKey)
    if (!option) return
    handleMentionSelect(option, 'keyboard')
  }

  const handleButtonDropdownOpenChange = (nextOpen: boolean) => {
    if (!(canEdit && buttonSuggestionItems.length)) {
      closeMentionPanel()
      return
    }

    if (nextOpen) {
      clearKeyboardOpenRaf()
      setKeyboardMentionOpen(false)
      setButtonMentionOpen(true)
      setActiveKeyboardCharacter(null)
      setMentionQuery('')
      return
    }

    setButtonMentionOpen(false)
    setActiveKeyboardCharacter(null)
    setMentionQuery('')
  }

  const handleKeyboardDropdownOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeKeyboardMentionPanel()
    }
  }

  const resolveEmployeeFromSlotConfig = (
    slotConfig?: Readonly<SenderSlotItem[]>,
  ): AiPromptMentionOption | undefined => {
    const slot = slotConfig?.find((item) => item.key === employeeSlotKey)
    if (!(slot && 'props' in slot)) return undefined

    const employeeValue =
      (slot.props as { employeeValue?: string } | undefined)?.employeeValue?.trim() ?? ''
    if (!employeeValue) return undefined

    return (
      buttonMentionOptionMap.get(employeeValue) ?? {
        value: employeeValue,
        label: employeeValue,
      }
    )
  }

  useEffect(() => {
    return () => {
      clearAnchorRaf()
      clearKeyboardOpenRaf()
    }
  }, [])

  useEffect(() => {
    if (!keyboardMentionOpen) return

    const inputElement = senderRef.current?.inputElement
    if (!(inputElement instanceof HTMLElement)) return

    scheduleCursorAnchorPosition()

    const onScroll = () => {
      updateCursorAnchorPosition()
    }

    const onWindowResize = () => {
      updateCursorAnchorPosition()
    }

    const onSelectionChange = () => {
      updateCursorAnchorPosition()
    }

    inputElement.addEventListener('scroll', onScroll)
    document.addEventListener('selectionchange', onSelectionChange)
    window.addEventListener('resize', onWindowResize)

    return () => {
      inputElement.removeEventListener('scroll', onScroll)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('resize', onWindowResize)
    }
  }, [keyboardMentionOpen])

  useResizeObserver({
    target: keyboardResizeTarget,
    enabled: Boolean(keyboardResizeTarget),
    onResize: () => {
      updateCursorAnchorPosition()
    },
  })

  useEffect(() => {
    if (!keyboardMentionOpen) {
      setKeyboardActiveIndex(-1)
      return
    }

    if (!visibleKeyboardMentionOptions.length) {
      setKeyboardActiveIndex(-1)
      return
    }

    if (showEmployeeSelector && activeKeyboardCharacter === '@' && selectedEmployeeKey) {
      const selectedIndex = visibleKeyboardMentionOptions.findIndex(
        (item) => item.value === selectedEmployeeKey,
      )
      if (selectedIndex >= 0) {
        setKeyboardActiveIndex(selectedIndex)
        return
      }
    }

    setKeyboardActiveIndex(0)
  }, [
    activeKeyboardCharacter,
    keyboardMentionOpen,
    selectedEmployeeKey,
    showEmployeeSelector,
    visibleKeyboardMentionOptions,
  ])

  useEffect(() => {
    if (keyboardMentionOpen && !keyboardTriggerCharacters.length) {
      closeKeyboardMentionPanel()
    }
  }, [keyboardMentionOpen, keyboardTriggerCharacters.length])

  useEffect(() => {
    if (!showEmployeeSelector) return

    const senderInstance = senderRef.current
    if (!senderInstance) return

    const senderValue = senderInstance.getValue?.()
    const currentContent = senderValue?.value ?? latestTextValueRef.current
    const currentEmployeeSlot = senderValue?.slotConfig?.find(
      (item) => item.key === employeeSlotKey,
    )
    const currentEmployeeValue = String(
      currentEmployeeSlot && 'props' in currentEmployeeSlot
        ? ((currentEmployeeSlot.props as { employeeValue?: string } | undefined)?.employeeValue ??
            '')
        : '',
    )
    const nextEmployeeValue = selectedEmployee?.value ?? ''

    if (currentEmployeeValue === nextEmployeeValue) return

    rebuildSenderContent(currentContent, selectedEmployee)

    if (selectedEmployee && sanitizeEditorValue(currentContent).length === 0) {
      normalizeCaretAfterEmployeeSlot()
    }
  }, [rebuildSenderContent, selectedEmployee, showEmployeeSelector])

  useEffect(() => {
    if (!(showEmployeeSelector && value !== undefined)) return

    const senderContent = senderRef.current?.getValue?.().value ?? ''
    if (senderContent === value) return

    rebuildSenderContent(value, selectedEmployee)

    if (selectedEmployee && sanitizeEditorValue(value).length === 0) {
      normalizeCaretAfterEmployeeSlot()
    }
  }, [rebuildSenderContent, selectedEmployee, showEmployeeSelector, value])

  const markMentionMenuMouseDown = () => {
    if (!buttonMentionOpen) {
      captureCaretSnapshot()
    }
    isMentionMenuMouseDownRef.current = true
  }

  const clearMentionMenuMouseDown = () => {
    requestAnimationFrame(() => {
      isMentionMenuMouseDownRef.current = false
    })
  }

  const renderMentionPopup = (menuNode: React.ReactNode) => {
    const isKeyboardPopup = keyboardMentionOpen || keyboardOpenRafRef.current !== null
    const hasOptions = isKeyboardPopup
      ? keyboardSuggestionItems.length > 0
      : buttonMentionOpen
        ? buttonSuggestionItems.length > 0
        : true

    return (
      <div
        className={styles.mentionDropdown}
        onMouseDownCapture={markMentionMenuMouseDown}
        onMouseUpCapture={clearMentionMenuMouseDown}
      >
        {hasOptions ? (
          menuNode
        ) : (
          <div className={styles.mentionEmpty}>
            {intl.get('aiPromptInput.emptyMentionContacts').d('无匹配的联系人')}
          </div>
        )}
      </div>
    )
  }

  const buttonMentionMenu = {
    items: buttonSuggestionItems,
    selectable: true,
    selectedKeys: selectedEmployeeKey ? [selectedEmployeeKey] : [],
    onClick: handleButtonMentionMenuClick,
  }

  const keyboardSelectedKeys = (() => {
    if (activeKeyboardCharacter !== '@') {
      return []
    }

    if (keyboardActiveKey) {
      return [keyboardActiveKey]
    }

    if (showEmployeeSelector && selectedEmployeeKey) {
      return [selectedEmployeeKey]
    }

    return []
  })()

  const keyboardMentionMenu = {
    items: keyboardSuggestionItems,
    selectable: true,
    selectedKeys: keyboardSelectedKeys,
    onClick: handleKeyboardMentionMenuClick,
  }

  const senderHeader = (
    <Sender.Header title="" open={attachments.length > 0} closable={false}>
      <ResizeObserver
        onResize={({ width }) => {
          if (width < 400) {
            setFileColSpan(12)
          } else {
            setFileColSpan(6)
          }
        }}
      >
        <div className={styles.fileHeaderContainer}>
          <Row gutter={[8, 8]} className={styles.fileHeaderList}>
            {attachments.map((file) => {
              const fileKey = getAttachmentFileKey(file)

              return (
                <Col key={fileKey} span={fileColSpan}>
                  <div className={styles.fileCardItem}>
                    <Tooltip title={file.name}>
                      <span className={styles.fileCardTooltipTarget}>
                        <FileCard
                          name={file.name}
                          byte={file.size}
                          size="small"
                          className={styles.fileCard}
                          classNames={{ name: styles.fileCardName }}
                        />
                      </span>
                    </Tooltip>
                    <div className={styles.fileCardRemoveAction}>
                      <Tooltip title={resolvedRemoveFileTitle}>
                        <Button
                          type="text"
                          size="small"
                          aria-label={resolvedRemoveFileTitle}
                          icon={<CloseCircleFilled />}
                          onClick={() => {
                            handleAttachmentRemove(fileKey)
                          }}
                        />
                      </Tooltip>
                    </div>
                  </div>
                </Col>
              )
            })}
          </Row>
        </div>
      </ResizeObserver>
    </Sender.Header>
  )

  const isButtonMentionOpen = buttonMentionOpen && buttonSuggestionItems.length > 0
  const isKeyboardMentionOpen =
    keyboardMentionOpen && activeKeyboardCharacter === '@' && keyboardMentionBaseOptions.length > 0

  return (
    <div className={clsx('AiPromptInput', styles.root, className)}>
      <div ref={cardRef} className={styles.card}>
        <Dropdown
          trigger={[]}
          placement="bottomLeft"
          destroyOnHidden
          open={isKeyboardMentionOpen}
          onOpenChange={handleKeyboardDropdownOpenChange}
          menu={keyboardMentionMenu}
          popupRender={renderMentionPopup}
        >
          <span
            className={styles.cursorAnchor}
            style={{
              left: `${cursorAnchor.left}px`,
              top: `${cursorAnchor.top}px`,
            }}
          />
        </Dropdown>

        <Sender
          ref={senderRef}
          value={mergedValue}
          slotConfig={useMentionSlotMode ? emptySenderSlotConfig : undefined}
          loading={loading}
          disabled={!canEdit}
          placeholder={placeholder}
          submitType="enter"
          header={senderHeader}
          suffix={false}
          autoSize={autoSize}
          className={styles.sender}
          onPasteFile={(files) => {
            handleFileChange(Array.from(files))
            senderRef.current?.focus?.()
          }}
          onChange={(nextValue, _event, slotConfigFromSender) => {
            const normalizedNextValue = sanitizeEditorValue(nextValue)
            latestTextValueRef.current = normalizedNextValue
            if (value === undefined) {
              setInnerValue(normalizedNextValue)
            }
            onChange?.(normalizedNextValue)

            if (showEmployeeSelector && !isRebuildingContentRef.current) {
              const effectiveSlotConfig =
                slotConfigFromSender ?? senderRef.current?.getValue?.().slotConfig

              if (effectiveSlotConfig !== undefined) {
                const employeeFromSlot = resolveEmployeeFromSlotConfig(effectiveSlotConfig)
                setEmployees((prev) => {
                  const prevValue = prev[0]?.value ?? ''
                  const nextEmployeeValue = employeeFromSlot?.value ?? ''
                  if (prevValue === nextEmployeeValue) return prev
                  return employeeFromSlot ? [employeeFromSlot] : []
                })
              }
            }

            if (!keyboardTriggerCharacters.length) {
              closeKeyboardMentionPanel()
              return
            }

            const inputElement = senderRef.current?.inputElement
            let valueBeforeCursor = normalizedNextValue
            if (inputElement instanceof HTMLTextAreaElement) {
              const cursorIndex = inputElement.selectionStart ?? normalizedNextValue.length
              valueBeforeCursor = normalizedNextValue.slice(0, cursorIndex)
            } else if (inputElement instanceof HTMLElement) {
              const textBeforeCursor = getContentEditableTextBeforeCursor(inputElement)
              valueBeforeCursor = textBeforeCursor
            }

            const triggerMatch = parseTriggerQueryBeforeCursor(
              valueBeforeCursor,
              valueBeforeCursor.length,
              keyboardTriggerCharacters,
            )
            if (triggerMatch === null) {
              closeKeyboardMentionPanel()
              return
            }

            const triggerOptions = keyboardTriggerOptionMap.get(triggerMatch.character) ?? []
            if (!(triggerOptions.length || triggerMatch.character === '@')) {
              closeKeyboardMentionPanel()
              return
            }

            setActiveKeyboardCharacter(triggerMatch.character)
            setMentionQuery(triggerMatch.query)
            openKeyboardMentionPanel()
          }}
          onSubmit={handleSubmit}
          onCancel={() => {
            onStop?.()
          }}
          onBlur={() => {
            if (isMentionMenuMouseDownRef.current) return
            if (buttonMentionOpen || keyboardMentionOpen || keyboardOpenRafRef.current !== null) {
              closeMentionPanel()
            }
          }}
          onKeyDown={(event) => {
            if (
              showEmployeeSelector &&
              !keyboardMentionOpen &&
              selectedEmployeeKey &&
              normalizedMergedValue.length === 0 &&
              (event.key === 'Backspace' || event.key === 'Delete')
            ) {
              event.preventDefault()
              setEmployees([])
              rebuildSenderContent('')
              closeMentionPanel()
              senderRef.current?.focus?.()
              return
            }

            if (keyboardMentionOpen && event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
            }

            const isKeyboardEmployeeMenuOpen =
              keyboardMentionOpen &&
              activeKeyboardCharacter === '@' &&
              visibleKeyboardMentionOptions.length > 0
            const isComposing = Boolean(event.nativeEvent.isComposing)

            if (isKeyboardEmployeeMenuOpen) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setKeyboardActiveIndex((prev) => {
                  const current = prev >= 0 ? prev : -1
                  return (current + 1) % visibleKeyboardMentionOptions.length
                })
                return
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setKeyboardActiveIndex((prev) => {
                  const current = prev >= 0 ? prev : 0
                  return (
                    (current - 1 + visibleKeyboardMentionOptions.length) %
                    visibleKeyboardMentionOptions.length
                  )
                })
                return
              }

              if (event.key === 'Enter' && !isComposing) {
                suppressSubmitForCurrentFrame()
                const normalizedIndex = keyboardActiveIndex >= 0 ? keyboardActiveIndex : 0
                const activeOption = visibleKeyboardMentionOptions[normalizedIndex]
                if (!activeOption) return

                if (activeOption.value === selectedEmployeeKey) {
                  closeMentionPanel()
                  restoreCaretSnapshot()
                  return
                }

                handleMentionSelect(activeOption, 'keyboard')
                return
              }
            }

            if (keyboardMentionOpen) {
              scheduleCursorAnchorPosition()
            }

            if (
              event.key === 'Escape' &&
              (buttonMentionOpen || keyboardMentionOpen || keyboardOpenRafRef.current !== null)
            ) {
              closeMentionPanel()
            }
          }}
          footer={(_, info) => {
            const { SendButton, LoadingButton } = info.components

            return (
              <Flex align="center" justify="space-between" className={styles.footer}>
                <Flex align="center" className={styles.leftActions}>
                  {(showEmployeeSelector || channelUserOptions.length > 0) && (
                    <Dropdown
                      trigger={['click']}
                      placement="topLeft"
                      destroyOnHidden
                      open={isButtonMentionOpen}
                      onOpenChange={handleButtonDropdownOpenChange}
                      menu={buttonMentionMenu}
                      popupRender={renderMentionPopup}
                    >
                      <Tooltip title={resolvedMentionButtonLabel}>
                        <span>
                          <Button
                            type="text"
                            aria-label={resolvedMentionButtonLabel}
                            disabled={!(canEdit && buttonSuggestionItems.length)}
                            onMouseDownCapture={captureCaretSnapshot}
                            onClick={openMentionPanel}
                            icon={<IconFont type="icon-at" className={styles.actionIcon} />}
                          />
                        </span>
                      </Tooltip>
                    </Dropdown>
                  )}

                  <Tooltip title={resolvedAttachButtonTitle}>
                    <Upload
                      multiple
                      showUploadList={false}
                      beforeUpload={() => false}
                      disabled={!canEdit}
                      onChange={({ file }) => {
                        const rawFile = getRawUploadFile(file)
                        if (rawFile) {
                          handleFileChange([rawFile])
                        }
                        senderRef.current?.focus?.()
                      }}
                    >
                      <Button
                        type="text"
                        aria-label={resolvedAttachButtonTitle}
                        disabled={!canEdit}
                        icon={<IconFont type="icon-attachment" className={styles.actionIcon} />}
                      />
                    </Upload>
                  </Tooltip>
                </Flex>

                {loading ? (
                  <Tooltip title={resolvedStopButtonTitle}>
                    <span>
                      <LoadingButton
                        type="primary"
                        shape="circle"
                        aria-label={resolvedStopButtonTitle as string}
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip title={resolvedSendButtonTitle}>
                    <span>
                      <SendButton
                        variant="text"
                        type="primary"
                        shape="circle"
                        aria-label={resolvedSendButtonTitle}
                        disabled={
                          !(canSubmit && (normalizedMergedValue.trim() || attachments.length))
                        }
                        icon={<SendOutlined />}
                      />
                    </span>
                  </Tooltip>
                )}
              </Flex>
            )
          }}
        />
      </div>
    </div>
  )
}

export default AiPromptInput
