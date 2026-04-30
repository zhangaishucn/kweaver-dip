vi.mock('../index.module.less', () => ({
  default: {},
}))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEnabledSkills } from '@/apis'
import { useDigitalHumanStore } from '../../digitalHumanStore'
import SkillConfig from '../index'

const mockDeleteSkill = vi.fn()
const mockUpdateSkills = vi.fn()
const mockSyncBuiltInSkills = vi.fn()

vi.mock('@/stores/languageStore', () => ({
  useLanguageStore: () => ({ language: 'zh-CN' }),
}))

vi.mock('../../digitalHumanStore', () => ({
  REMOVABLE_PRESET_SKILL_NAMES: new Set(['feishu-push']),
  useDigitalHumanStore: vi.fn(),
}))

vi.mock('@/apis', () => ({
  getEnabledSkills: vi.fn(),
}))

vi.mock('@/components/ScrollBarContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-bar-container">{children}</div>
  ),
}))

vi.mock('../SelectSkillModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="select-skill-modal" /> : null,
}))

vi.mock('../AddSkillDrawer', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="add-skill-drawer" /> : null),
}))

vi.mock('@/components/IconFont', () => ({
  default: () => <span data-testid="icon-font" />,
}))

const mockedUseDigitalHumanStore = vi.mocked(useDigitalHumanStore)
const mockedGetEnabledSkills = vi.mocked(getEnabledSkills)

const addSkillBtnName = 'digitalHuman.skill.addSkillButton'

describe('DigitalHumanSetting/SkillConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetEnabledSkills.mockResolvedValue([])
  })

  it('应该正确渲染空状态，显示添加技能按钮', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    expect(screen.getByText('digitalHuman.setting.menuSkill')).toBeInTheDocument()
    expect(screen.getByText('digitalHuman.skill.sectionDesc')).toBeInTheDocument()
    expect(screen.getByText('digitalHuman.skill.emptyNoSkills')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: addSkillBtnName })).toBeInTheDocument()
  })

  it('只读模式空状态不显示添加按钮', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig readonly />)

    expect(screen.getByText('digitalHuman.skill.emptyNoSkills')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: addSkillBtnName })).not.toBeInTheDocument()
  })

  it('已有技能时应该正确渲染表格', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '产品问答',
          description: '回答产品相关问题',
          built_in: false,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    expect(screen.getByText('产品问答')).toBeInTheDocument()
    expect(screen.getByText('回答产品相关问题')).toBeInTheDocument()
    expect(screen.getByText('@digitalHuman.skill.tagOfficial')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: addSkillBtnName })).toBeInTheDocument()
  })

  it('内置技能删除按钮禁用', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '基础能力',
          description: '数字员工基本能力',
          built_in: true,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => !btn.textContent?.trim())
    expect(deleteBtn).toBeDisabled()
  })

  it('只读模式不显示操作列', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '产品问答',
          description: '回答产品相关问题',
          built_in: false,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig readonly />)

    expect(screen.getByText('产品问答')).toBeInTheDocument()
    expect(screen.queryByText('digitalHuman.common.columnAction')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: addSkillBtnName })).not.toBeInTheDocument()
  })

  it('自定义技能显示正确标签', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '我的技能',
          description: '自定义技能',
          built_in: false,
          type: 'openclaw-managed',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    expect(screen.getByText('@digitalHuman.skill.tagCustom')).toBeInTheDocument()
  })

  it('点击添加技能按钮应该打开弹窗', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '产品问答',
          description: '回答产品相关问题',
          built_in: false,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)
    fireEvent.click(screen.getByRole('button', { name: addSkillBtnName }))

    expect(screen.getByTestId('select-skill-modal')).toBeInTheDocument()
  })

  it('空状态下点击添加技能应该打开弹窗', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)
    fireEvent.click(screen.getByRole('button', { name: addSkillBtnName }))

    expect(screen.getByTestId('select-skill-modal')).toBeInTheDocument()
  })

  it('点击删除按钮应该调用 deleteSkill', () => {
    mockedUseDigitalHumanStore.mockReturnValue({
      skills: [
        {
          name: '产品问答',
          description: '回答产品相关问题',
          built_in: false,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)
    const buttons = screen.getAllByRole('button')
    const removeBtn = buttons.find((btn) => !btn.textContent?.trim())
    if (removeBtn) {
      fireEvent.click(removeBtn)
    }

    expect(mockDeleteSkill).toHaveBeenCalledWith('产品问答')
  })

  it('进入技能配置时会预置内置技能', async () => {
    mockedGetEnabledSkills.mockResolvedValue([
      { name: '内置技能', built_in: true, type: 'official' },
      { name: '普通技能', built_in: false, type: 'official' },
    ] as any)
    mockedUseDigitalHumanStore.mockReturnValue({
      uiMode: 'create',
      skills: [],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    await waitFor(() => {
      expect(mockSyncBuiltInSkills).toHaveBeenCalledWith([
        { name: '内置技能', built_in: true, type: 'official' },
      ])
    })
  })

  it('创建态进入技能配置时会预置 feishu-push 且保持可移除', async () => {
    mockedGetEnabledSkills.mockResolvedValue([
      { name: 'archive-protocol', built_in: true, type: 'official' },
      { name: 'feishu-push', built_in: false, type: 'official' },
      { name: '普通技能', built_in: false, type: 'official' },
    ] as any)
    mockedUseDigitalHumanStore.mockReturnValue({
      uiMode: 'create',
      skills: [
        {
          name: 'feishu-push',
          description: '推送飞书消息',
          built_in: false,
          type: 'official',
        },
      ],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    await waitFor(() => {
      expect(mockSyncBuiltInSkills).toHaveBeenCalledWith([
        { name: 'archive-protocol', built_in: true, type: 'official' },
        { name: 'feishu-push', built_in: false, type: 'official' },
      ])
    })

    const buttons = screen.getAllByRole('button')
    const deleteBtn = buttons.find((btn) => !btn.textContent?.trim())
    if (deleteBtn === undefined) {
      throw new Error('expected delete button')
    }
    expect(deleteBtn).not.toBeDisabled()
    fireEvent.click(deleteBtn)
    expect(mockDeleteSkill).toHaveBeenCalledWith('feishu-push')
  })

  it('编辑态进入技能配置时不会自动加载预置技能', () => {
    mockedGetEnabledSkills.mockResolvedValue([
      { name: 'archive-protocol', built_in: true, type: 'official' },
      { name: 'feishu-push', built_in: false, type: 'official' },
    ] as any)
    mockedUseDigitalHumanStore.mockReturnValue({
      uiMode: 'edit',
      skills: [],
      deleteSkill: mockDeleteSkill,
      updateSkills: mockUpdateSkills,
      syncBuiltInSkills: mockSyncBuiltInSkills,
      digitalHumanId: 'test-id',
    })

    render(<SkillConfig />)

    expect(mockedGetEnabledSkills).not.toHaveBeenCalled()
    expect(mockSyncBuiltInSkills).not.toHaveBeenCalled()
  })
})
