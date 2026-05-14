import { useEffect, useState } from 'react';
import intl from 'react-intl-universal';
import { Form, Input, Modal, Select, message } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import { getOperatorCategory, getSkillInfo, putSkillMetadata } from '@/apis/agent-operator-integration';
import { useMicroWidgetProps } from '@/hooks';
import { validateName } from '@/utils/validators';
import { unwrapSkillResponse } from './shared';

interface EditSkillModalProps {
  skillInfo: any;
  onCancel: () => void;
  onOk: () => void;
}

export default function EditSkillModal({ skillInfo, onCancel, onOk }: EditSkillModalProps) {
  const microWidgetProps = useMicroWidgetProps();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [categoryData, detailResponse] = await Promise.all([
          getOperatorCategory(),
          getSkillInfo(skillInfo?.skill_id),
        ]);
        const options = categoryData || [];
        const detailInfo = unwrapSkillResponse(detailResponse);
        setCategoryOptions(options);
        form.setFieldsValue({
          name: detailInfo?.name || '',
          description: detailInfo?.description || '',
          category: detailInfo?.category || options?.[0]?.category_type || '',
        });
      } catch (error) {
        console.error(error);
      }
    };

    fetchInitialData();
  }, [form, skillInfo]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await putSkillMetadata(skillInfo?.skill_id, values);
      message.success(intl.get('skill.editSuccess'));
      onOk();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }

      if (error?.description) {
        message.error(error.description);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      centered
      width={640}
      title={intl.get('skill.editTitle')}
      okText={intl.get('adminManagement.confirm')}
      cancelText={intl.get('adminManagement.cancel')}
      maskClosable={false}
      confirmLoading={submitting}
      okButtonProps={{ className: 'dip-w-74' }}
      cancelButtonProps={{ className: 'dip-w-74' }}
      onCancel={onCancel}
      onOk={handleSubmit}
      getContainer={() => microWidgetProps.container}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          <OkBtn />
          <CancelBtn />
        </>
      )}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={intl.get('skill.name')}
          name="name"
          required
          rules={[
            {
              validator: (_, value) => {
                if (!value) {
                  return Promise.reject(new Error(intl.get('skill.nameRequired')));
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <Input maxLength={64} showCount placeholder={intl.get('skill.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={intl.get('skill.description')}
          name="description"
          rules={[{ required: true, message: intl.get('skill.descriptionRequired') }]}
        >
          <TextArea autoSize={{ minRows: 4, maxRows: 10 }} placeholder={intl.get('skill.descriptionPlaceholder')} />
        </Form.Item>

        <Form.Item
          label={intl.get('skill.category')}
          name="category"
          rules={[{ required: true, message: intl.get('skill.categoryRequired') }]}
        >
          <Select placeholder={intl.get('skill.selectCategory')}>
            {categoryOptions?.map((item: any) => (
              <Select.Option key={item.category_type} value={item.category_type}>
                {item.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
