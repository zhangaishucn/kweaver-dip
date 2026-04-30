import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Spin } from 'antd'
import { Copilot, type CopilotProps } from '@kweaver-ai/chatkit'
import Cookies from 'js-cookie'
import qaColored from '@/assets/qaColored.png'
import { formatError, loginConfigs, ssoGet } from '@/core'
import { useMicroAppProps } from '@/context'
import { axiosInstance } from '@/utils/request'
import styles from './styles.module.less'

const MESSAGE_NAMESPACE = 'chat-copilot-plugin'
const TOKEN_INVALID_MESSAGE =
    'Token 已失效，Chat Copilot 已停止加载，请重新获取有效凭证。'
const TOKEN_REFRESH_FAILED_MESSAGE =
    'Token 刷新失败，Chat Copilot 已停止加载，请重新获取有效凭证。'
const CONFIG_MISSING_MESSAGE = '请先配置 baseUrl、agentKey 和 token'

type LayoutMode = 'collapsed' | 'expanded'

interface ChatCopilotConfig {
    title: string
    baseUrl: string
    agentKey: string
    businessDomain: string
    useInternalToken: boolean
    iconLabel: string
    collapsedWidth: number
    collapsedHeight: number
    expandedWidth: number
    expandedHeight: string
    defaultOpen: boolean
}

interface PluginMessage {
    namespace: string
    type: string
    payload?: Record<string, any>
}

const DEFAULT_CONFIG: ChatCopilotConfig = {
    title: 'Data Agent Copilot',
    baseUrl: `${window.location.origin}/api/agent-factory/v1`,
    agentKey: '',
    businessDomain: 'bd_public',
    useInternalToken: true,
    iconLabel: 'Data Agent Copilot',
    collapsedWidth: 72,
    collapsedHeight: 72,
    expandedWidth: 420,
    expandedHeight: '80vh',
    defaultOpen: false,
}

const parseNumber = (value: string | null, fallback: number) => {
    if (!value) return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

const parseBoolean = (value: string | null, fallback: boolean) => {
    if (value === null) return fallback
    return value !== 'false'
}

const parseQueryConfig = (): Partial<ChatCopilotConfig> => {
    const searchParams = new URLSearchParams(window.location.search)

    return {
        title: searchParams.get('title') || undefined,
        baseUrl: searchParams.get('baseUrl') || undefined,
        agentKey: searchParams.get('agentKey') || undefined,
        businessDomain: searchParams.get('businessDomain') || undefined,
        useInternalToken: parseBoolean(
            searchParams.get('useInternalToken'),
            DEFAULT_CONFIG.useInternalToken,
        ),
        iconLabel: searchParams.get('iconLabel') || undefined,
        collapsedWidth: parseNumber(
            searchParams.get('collapsedWidth'),
            DEFAULT_CONFIG.collapsedWidth,
        ),
        collapsedHeight: parseNumber(
            searchParams.get('collapsedHeight'),
            DEFAULT_CONFIG.collapsedHeight,
        ),
        expandedWidth: parseNumber(
            searchParams.get('expandedWidth'),
            DEFAULT_CONFIG.expandedWidth,
        ),
        expandedHeight:
            searchParams.get('expandedHeight') || DEFAULT_CONFIG.expandedHeight,
        defaultOpen:
            searchParams.get('defaultOpen') === 'true' ||
            searchParams.get('open') === 'true',
    }
}

function App() {
    const { microAppProps } = useMicroAppProps()
    const [config, setConfig] = useState<ChatCopilotConfig>({
        ...DEFAULT_CONFIG,
        ...parseQueryConfig(),
    })
    const [sourceToken, setSourceToken] = useState(
        new URLSearchParams(window.location.search).get('token') || '',
    )
    const [effectiveToken, setEffectiveToken] = useState('')
    const [isOpen, setIsOpen] = useState(config.defaultOpen)
    const [isReady, setIsReady] = useState(false)
    const [isResolvingToken, setIsResolvingToken] = useState(false)
    const [fatalError, setFatalError] = useState('')
    const pendingRefreshRef = useRef<
        Map<
            string,
            {
                resolve: (value: string) => void
                reject: (reason?: any) => void
            }
        >
    >(new Map())
    const refreshCounterRef = useRef(0)

    const targetOrigin = useMemo(() => {
        if (window.parent === window) {
            return '*'
        }
        try {
            if (!document.referrer) {
                return '*'
            }

            const referrerOrigin = new URL(document.referrer).origin
            return referrerOrigin && referrerOrigin !== 'null'
                ? referrerOrigin
                : '*'
        } catch (error) {
            return '*'
        }
    }, [])

    const postToParent = (type: string, payload?: Record<string, any>) => {
        if (window.parent === window) return
        window.parent.postMessage(
            {
                namespace: MESSAGE_NAMESPACE,
                type,
                payload,
            },
            targetOrigin,
        )
    }

    const emitLayout = (mode: LayoutMode) => {
        postToParent('layout-change', {
            mode,
            width:
                mode === 'expanded'
                    ? config.expandedWidth
                    : config.collapsedWidth,
            height:
                mode === 'expanded'
                    ? config.expandedHeight
                    : config.collapsedHeight,
        })
    }

    const clearResolvedToken = () => {
        setEffectiveToken('')
        Cookies.remove('af.oauth2_token', { path: '/' })
        localStorage.removeItem('af_token')

        if (axiosInstance.defaults.headers?.common?.Authorization) {
            delete axiosInstance.defaults.headers.common.Authorization
        }
    }

    const resetFatalError = () => {
        setFatalError('')
    }

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error && error.message) {
            return error.message
        }

        if (typeof error === 'string' && error) {
            return error
        }

        return TOKEN_INVALID_MESSAGE
    }

    const rejectPendingRefresh = (message: string) => {
        pendingRefreshRef.current.forEach((pending) => {
            pending.reject(new Error(message))
        })
        pendingRefreshRef.current.clear()
    }

    const disableCopilot = (message: string) => {
        clearResolvedToken()
        rejectPendingRefresh(message)
        setFatalError(message)
        setIsOpen(true)
    }

    const persistToken = (nextToken: string) => {
        Cookies.set('af.oauth2_token', nextToken, {
            httpOnly: false,
            path: '/',
        })
        localStorage.setItem('af_token', nextToken)
        axiosInstance.defaults.headers.common =
            axiosInstance.defaults.headers.common || {}
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${nextToken}`
        setEffectiveToken(nextToken)
    }

    const resolveUsableToken = async (
        rawToken: string,
        useInternalToken: boolean,
    ) => {
        if (!rawToken) {
            clearResolvedToken()
            return ''
        }

        if (useInternalToken) {
            persistToken(rawToken)
            return rawToken
        }

        const loginConfig = await loginConfigs()
        const thirdpartyid = loginConfig?.thirdauth?.id || ''
        const searchParams = new URLSearchParams({
            token: rawToken,
        })

        if (thirdpartyid) {
            searchParams.set('thirdpartyid', thirdpartyid)
        }

        const response = await ssoGet(`?${searchParams.toString()}`)
        const nextToken = response?.access_token || ''

        if (!nextToken) {
            clearResolvedToken()
            return ''
        }

        persistToken(nextToken)
        return nextToken
    }

    useEffect(() => {
        setIsOpen(config.defaultOpen)
    }, [config.defaultOpen])

    useEffect(() => {
        if (
            !sourceToken &&
            typeof microAppProps?.token?.accessToken === 'string'
        ) {
            resetFatalError()
            setSourceToken(microAppProps.token.accessToken)
        }
    }, [microAppProps?.token, sourceToken])

    useEffect(() => {
        let disposed = false

        const syncToken = async () => {
            if (!sourceToken) {
                clearResolvedToken()
                return
            }

            if (fatalError) {
                return
            }

            setIsResolvingToken(true)
            try {
                const nextToken = await resolveUsableToken(
                    sourceToken,
                    config.useInternalToken,
                )

                if (!disposed && !nextToken) {
                    disableCopilot(TOKEN_INVALID_MESSAGE)
                }
            } catch (error) {
                if (!disposed) {
                    disableCopilot(getErrorMessage(error))
                    formatError(error)
                }
            } finally {
                if (!disposed) {
                    setIsResolvingToken(false)
                }
            }
        }

        syncToken()

        return () => {
            disposed = true
        }
    }, [config.useInternalToken, fatalError, sourceToken])

    useEffect(() => {
        const handleMessage = (event: MessageEvent<PluginMessage>) => {
            const { data } = event
            if (!data || data.namespace !== MESSAGE_NAMESPACE) return
            const { payload } = data

            if (
                event.source &&
                window.parent !== window &&
                event.source !== window.parent
            ) {
                return
            }

            switch (data.type) {
                case 'init': {
                    const nextConfig = payload?.config || {}
                    setConfig((prev) => ({
                        ...prev,
                        ...nextConfig,
                    }))
                    if (typeof payload?.token === 'string') {
                        resetFatalError()
                        setSourceToken(payload.token)
                    }
                    if (typeof payload?.open === 'boolean') {
                        setIsOpen(payload.open)
                    }
                    setIsReady(true)
                    break
                }
                case 'set-token':
                    if (typeof payload?.token === 'string') {
                        resetFatalError()
                        setSourceToken(payload.token)
                    }
                    break
                case 'update-config':
                    setConfig((prev) => ({
                        ...prev,
                        ...(payload?.config || {}),
                    }))
                    break
                case 'open':
                    setIsOpen(true)
                    break
                case 'close':
                    setIsOpen(false)
                    break
                case 'toggle':
                    setIsOpen((prev) => !prev)
                    break
                case 'refresh-token-result': {
                    const requestId = payload?.requestId
                    if (!requestId) return
                    const pending = pendingRefreshRef.current.get(requestId)
                    if (!pending) return
                    pendingRefreshRef.current.delete(requestId)
                    if (payload?.error) {
                        pending.reject(new Error(payload.error))
                    } else {
                        pending.resolve(payload?.token || '')
                    }
                    break
                }
                default:
                    break
            }
        }

        window.addEventListener('message', handleMessage)
        postToParent('ready', {
            config,
        })
        setIsReady(window.parent === window)

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [])

    const panelVisible = isOpen || Boolean(fatalError)

    useEffect(() => {
        emitLayout(panelVisible ? 'expanded' : 'collapsed')
    }, [
        config.collapsedHeight,
        config.collapsedWidth,
        config.expandedHeight,
        config.expandedWidth,
        panelVisible,
    ])

    const refreshToken = async () => {
        if (fatalError) {
            return ''
        }

        let nextSourceToken = ''

        try {
            if (microAppProps?.token?.refreshToken) {
                const result = await microAppProps.token.refreshToken()
                nextSourceToken =
                    result?.accessToken || result?.access_token || ''
            } else if (window.parent === window) {
                nextSourceToken = sourceToken || effectiveToken
            } else {
                const requestId = `refresh-${Date.now()}-${
                    refreshCounterRef.current
                }`
                refreshCounterRef.current += 1

                nextSourceToken = await new Promise<string>(
                    (resolve, reject) => {
                        pendingRefreshRef.current.set(requestId, {
                            resolve,
                            reject,
                        })
                        postToParent('request-token-refresh', {
                            requestId,
                        })
                    },
                )
            }
        } catch (error) {
            disableCopilot(getErrorMessage(error))
            formatError(error)
            return ''
        }

        if (!nextSourceToken) {
            disableCopilot(TOKEN_REFRESH_FAILED_MESSAGE)
            return ''
        }

        resetFatalError()
        setSourceToken(nextSourceToken)

        try {
            const nextToken = await resolveUsableToken(
                nextSourceToken,
                config.useInternalToken,
            )

            if (!nextToken) {
                disableCopilot(TOKEN_REFRESH_FAILED_MESSAGE)
            }

            return nextToken
        } catch (error) {
            disableCopilot(getErrorMessage(error))
            formatError(error)
            return ''
        }
    }

    const canRenderCopilot = Boolean(
        !fatalError && config.baseUrl && config.agentKey && effectiveToken,
    )
    const showLauncher = !panelVisible && !fatalError

    return (
        <div
            className={styles.shell}
            data-mode={panelVisible ? 'expanded' : 'collapsed'}
        >
            <button
                type="button"
                className={styles.launcher}
                data-visible={showLauncher}
                aria-label={config.iconLabel || config.title}
                onClick={() => setIsOpen(true)}
            >
                <img
                    className={styles.launcherIcon}
                    src={qaColored}
                    alt={config.title}
                />
            </button>

            <div
                className={styles.panel}
                data-visible={panelVisible}
                aria-hidden={!panelVisible}
            >
                <div className={styles.panelBody}>
                    {!isReady && (
                        <div className={styles.placeholder}>
                            <Spin tip="正在连接插件..." />
                        </div>
                    )}

                    {isReady && isResolvingToken && (
                        <div className={styles.placeholder}>
                            <Spin tip="正在处理 Token..." />
                        </div>
                    )}

                    {isReady && !isResolvingToken && Boolean(fatalError) && (
                        <div className={styles.placeholder}>
                            <Empty
                                description={fatalError}
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        </div>
                    )}

                    {isReady &&
                        !isResolvingToken &&
                        !fatalError &&
                        !canRenderCopilot && (
                            <div className={styles.placeholder}>
                                <Empty
                                    description={CONFIG_MISSING_MESSAGE}
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                                <div className={styles.placeholderActions}>
                                    <Button
                                        type="primary"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        收起
                                    </Button>
                                </div>
                            </div>
                        )}

                    {!isResolvingToken &&
                        canRenderCopilot &&
                        React.createElement(
                            Copilot as any,
                            {
                                title: config.title,
                                visible: panelVisible,
                                onClose: () => setIsOpen(false),
                                baseUrl: config.baseUrl,
                                agentKey: config.agentKey,
                                token: effectiveToken,
                                refreshToken,
                                businessDomain:
                                    config.businessDomain || undefined,
                            } as CopilotProps,
                        )}
                </div>
            </div>
        </div>
    )
}

export default App
