import { Alert, Button, Form, Input } from 'antd'
import { useEffect, useState } from 'react'
import intl from 'react-intl-universal'
import type { GuideInitializeRequest, OpenClawDetectedConfig } from '@/apis/dip-studio/guide'
import { getOpenClawDetectedConfig, initializeGuide } from '@/apis/dip-studio/guide'
import ScrollBarContainer from '@/components/ScrollBarContainer'
import { DEFAULT_KWEAVER_BASE_URL } from '../../types'

interface SystemConnectOpenClawPanelProps {
  onCancel: () => void
}

function validateKweaverBaseUrl(_: unknown, value: string | undefined) {
  const v = value?.trim()
  if (!v) {
    return Promise.reject(
      new Error(intl.get('initialConfiguration.connect.kweaverBaseUrlRequired')),
    )
  }
  try {
    const u = new URL(v)
    if (!['http:', 'https:'].includes(u.protocol)) {
      return Promise.reject(
        new Error(intl.get('initialConfiguration.connect.kweaverBaseUrlInvalidProtocol')),
      )
    }
    return Promise.resolve()
  } catch {
    return Promise.reject(new Error(intl.get('initialConfiguration.connect.kweaverBaseUrlInvalid')))
  }
}

const SystemConnectOpenClawPanel = ({ onCancel }: SystemConnectOpenClawPanelProps) => {
  const [form] = Form.useForm<GuideInitializeRequest>()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchOpenClawConfig = async () => {
      try {
        setLoading(true)
        const cfg: OpenClawDetectedConfig = await getOpenClawDetectedConfig()
        if (cancelled) return
        form.setFieldsValue({
          openclaw_address: cfg.openclaw_address,
          openclaw_token: cfg.openclaw_token,
          kweaver_base_url: cfg.kweaver_base_url ?? DEFAULT_KWEAVER_BASE_URL,
        })
      } catch {
        form.setFieldsValue({
          kweaver_base_url: DEFAULT_KWEAVER_BASE_URL,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchOpenClawConfig()
    return () => {
      cancelled = true
    }
  }, [form])

  const getInitializeRequest = (values: GuideInitializeRequest): GuideInitializeRequest => {
    const openclawAddress = values.openclaw_address.trim()
    const openclawToken = values.openclaw_token.trim()
    const kweaverBaseUrl = values.kweaver_base_url.trim()

    return {
      openclaw_address: openclawAddress,
      openclaw_token: openclawToken,
      kweaver_base_url: kweaverBaseUrl,
    }
  }

  const handleFormSubmit = async (values: GuideInitializeRequest) => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      const body = getInitializeRequest(values)
      await initializeGuide(body)
      setShowSuccessBanner(true)
    } catch (error: any) {
      setSubmitError(error?.description || intl.get('initialConfiguration.errors.initFailed'))
      setShowSuccessBanner(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-black font-bold text-[17px] px-6">
        {intl.get('initialConfiguration.connect.title')}
      </div>
      <div className="text-black/50 text-sm mt-2 mb-4 px-6">
        {intl.get('initialConfiguration.connect.subtitle')}
      </div>
      {showSuccessBanner && (
        <Alert
          className="mb-6 mt-2 w-[548px] mx-auto"
          type="success"
          showIcon
          closable={{ closeIcon: true, afterClose: () => setShowSuccessBanner(false) }}
          title={intl.get('initialConfiguration.result.title')}
          description="系统已与OpenClaw建立安全通道"
          styles={{
            title: { fontSize: '16px', fontWeight: '500' },
            icon: { fontSize: '21px', marginTop: '2px' },
            close: { color: '#52C41A !important' },
          }}
        />
      )}
      <ScrollBarContainer className="flex flex-col items-center">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            openclaw_address: '',
            openclaw_token: '',
            kweaver_base_url: '',
          }}
          onValuesChange={(changedValues) => {
            setShowSuccessBanner(false)
            const changedKeys = Object.keys(changedValues) as Array<keyof GuideInitializeRequest>
            const fieldsToClear = changedKeys.map((key) => ({ name: key, errors: [] }))
            form.setFields(fieldsToClear)
          }}
          onFinish={(values) => {
            void handleFormSubmit(values)
          }}
          className="w-[548px] pt-4"
        >
          <Form.Item
            label={intl.get('initialConfiguration.connect.connectionAddressLabel')}
            name="openclaw_address"
            validateTrigger="onSubmit"
            rules={[
              {
                required: true,
                message: intl.get('initialConfiguration.connect.connectionAddressRequired'),
              },
            ]}
          >
            <Input
              placeholder={intl.get('initialConfiguration.connect.connectionAddressPlaceholder')}
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label={intl.get('initialConfiguration.connect.tokenLabel')}
            name="openclaw_token"
            validateTrigger="onSubmit"
            rules={[
              { required: true, message: intl.get('initialConfiguration.connect.tokenRequired') },
            ]}
          >
            <Input
              placeholder={intl.get('initialConfiguration.connect.tokenPlaceholder')}
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label={intl.get('initialConfiguration.connect.kweaverBaseUrlLabel')}
            name="kweaver_base_url"
            validateTrigger="onSubmit"
            rules={[{ validator: validateKweaverBaseUrl }]}
          >
            <Input
              placeholder={intl.get('initialConfiguration.connect.kweaverBaseUrlPlaceholder')}
              disabled={loading}
            />
          </Form.Item>
        </Form>
        {/* 报错信息 */}
        <div className="text-sm text-[--dip-error-color] self-start w-[548px] mx-auto">
          {submitError || ''}
        </div>
      </ScrollBarContainer>
      <div className="flex items-end justify-end mt-4 shrink-0 w-[548px] mx-auto flex-1">
        <div className="flex gap-3">
          <Button
            type="primary"
            loading={submitting}
            onClick={() => {
              void form
                .validateFields()
                .then((values) => {
                  void handleFormSubmit(values)
                })
                .catch(() => {})
            }}
          >
            确定
          </Button>
          {/* <Button
            onClick={() => {
              void form
                .validateFields()
                .then((values) => {
                  void handleFormSubmit(values)
                })
                .catch(() => {})
            }}
          >
            测试连接
          </Button> */}
          <Button onClick={onCancel}>取消</Button>
        </div>
      </div>
    </div>
  )
}

export default SystemConnectOpenClawPanel
