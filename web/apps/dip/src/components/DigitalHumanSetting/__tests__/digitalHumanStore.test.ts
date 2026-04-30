import { beforeEach, describe, expect, it } from 'vitest'

import { useDigitalHumanStore } from '../digitalHumanStore'

describe('DigitalHumanSetting/digitalHumanStore', () => {
  beforeEach(() => {
    useDigitalHumanStore.getState().reset()
  })

  it('bindDigitalHuman(null) 会清空当前编辑数据', () => {
    const store = useDigitalHumanStore.getState()
    store.updateBasic({ name: 'n1' })
    store.bindDigitalHuman(null)

    const state = useDigitalHumanStore.getState()
    expect(state.digitalHumanId).toBeUndefined()
    expect(state.basic).toEqual({ name: '', creature: '', soul: '' })
    expect(state.bkn).toEqual([])
    expect(state.skills).toEqual([])
    expect(state.channel).toBeUndefined()
    expect(state.detail).toBeNull()
    expect(state.dirty).toBe(false)
  })

  it('bindDigitalHuman 会按 detail 初始化并记录快照', () => {
    const detail = {
      id: 'dh-1',
      name: '员工A',
      creature: '简介A',
      soul: '灵魂A',
      bkn: [{ url: 'u1' }],
      channel: { type: 'feishu' },
    } as any
    const skills = [{ name: '技能A' }, { name: '技能B' }] as any[]

    useDigitalHumanStore.getState().bindDigitalHuman(detail, skills as any)
    const state = useDigitalHumanStore.getState()

    expect(state.digitalHumanId).toBe('dh-1')
    expect(state.basic).toEqual({ name: '员工A', creature: '简介A', soul: '灵魂A' })
    expect(state.bkn).toEqual([{ url: 'u1' }])
    expect(state.skills).toEqual(skills)
    expect(state.channel).toEqual({ type: 'feishu' })
    expect(state.detail?.skills).toEqual(skills)
    expect(state.dirty).toBe(false)
  })

  it('update/delete 系列会更新字段并标记 dirty', () => {
    const store = useDigitalHumanStore.getState()
    store.updateBasic({ name: 'N' })
    store.updateBkn([{ url: 'u1' }] as any)
    store.updateSkills([{ name: 's1' }, { name: 's2' }] as any)
    store.deleteBkn('u1')
    store.deleteSkill('s2')
    store.updateChannel({ type: 'wechat' } as any)
    store.deleteChannel()

    const state = useDigitalHumanStore.getState()
    expect(state.basic.name).toBe('N')
    expect(state.bkn).toEqual([])
    expect(state.skills).toEqual([{ name: 's1' }])
    expect(state.channel).toBeUndefined()
    expect(state.dirty).toBe(true)
  })

  it('syncBuiltInSkills 会补齐内置技能且不标记 dirty', () => {
    const detail = {
      id: 'dh-3',
      name: '员工C',
      creature: '简介C',
      soul: '灵魂C',
    } as any
    const store = useDigitalHumanStore.getState()
    store.bindDigitalHuman(detail, [{ name: '技能1', built_in: false }] as any)

    store.syncBuiltInSkills([
      { name: '内置技能', built_in: true },
      { name: '技能1', built_in: false },
    ] as any)

    const state = useDigitalHumanStore.getState()
    expect(state.skills).toEqual([
      { name: '技能1', built_in: false },
      { name: '内置技能', built_in: true },
    ])
    expect(state.detail?.skills).toEqual([
      { name: '技能1', built_in: false },
      { name: '内置技能', built_in: true },
    ])
    expect(state.dirty).toBe(false)
  })

  it('可移除预置技能被删除后不会被 syncBuiltInSkills 补回', () => {
    const store = useDigitalHumanStore.getState()
    store.updateSkills([{ name: 'feishu-push', built_in: false }] as any)

    store.deleteSkill('feishu-push')
    store.resetDirtyState()
    store.syncBuiltInSkills([{ name: 'feishu-push', built_in: false }] as any)

    const state = useDigitalHumanStore.getState()
    expect(state.skills).toEqual([])
    expect(state.removedPresetSkillNames).toEqual(['feishu-push'])
    expect(state.dirty).toBe(false)
  })

  it('重新添加可移除预置技能后会清理移除记录', () => {
    const store = useDigitalHumanStore.getState()
    store.updateSkills([{ name: 'feishu-push', built_in: false }] as any)
    store.deleteSkill('feishu-push')

    store.updateSkills([{ name: 'feishu-push', built_in: false }] as any)

    const state = useDigitalHumanStore.getState()
    expect(state.skills).toEqual([{ name: 'feishu-push', built_in: false }])
    expect(state.removedPresetSkillNames).toEqual([])
    expect(state.dirty).toBe(true)
  })

  it('resetAllToDetail 会回滚到 detail 快照并清理 dirty', () => {
    const detail = {
      id: 'dh-2',
      name: '员工B',
      creature: '简介B',
      soul: '灵魂B',
      bkn: [{ url: 'u2' }],
      channel: { type: 'feishu' },
    } as any
    const skills = [{ name: '技能1' }] as any[]
    const store = useDigitalHumanStore.getState()
    store.bindDigitalHuman(detail, skills as any)
    store.updateBasic({ name: '改名' })
    store.updateBkn([])
    store.updateSkills([])

    useDigitalHumanStore.getState().resetAllToDetail()
    const state = useDigitalHumanStore.getState()

    expect(state.basic).toEqual({ name: '员工B', creature: '简介B', soul: '灵魂B' })
    expect(state.bkn).toEqual([{ url: 'u2' }])
    expect(state.skills).toEqual(skills)
    expect(state.dirty).toBe(false)
  })

  it('setUiMode(edit) 会冻结显示名，非 edit 会清空冻结名', () => {
    const store = useDigitalHumanStore.getState()
    store.updateBasic({ name: '  名称X  ' })
    store.setUiMode('edit')
    expect(useDigitalHumanStore.getState().frozenDisplayNameForEdit).toBe('名称X')

    store.setUiMode('view')
    expect(useDigitalHumanStore.getState().frozenDisplayNameForEdit).toBeNull()
  })
})
