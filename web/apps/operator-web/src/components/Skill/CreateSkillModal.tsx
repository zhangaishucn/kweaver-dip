import { useEffect, useState } from 'react';
import intl from 'react-intl-universal';
import type { UploadFile, UploadProps } from 'antd';
import { Form, Modal, Select, Upload, message } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { getOperatorCategory, postSkill, putSkillPackage } from '@/apis/agent-operator-integration';
import { useMicroWidgetProps } from '@/hooks';

const { Dragger } = Upload;

interface CreateSkillModalProps {
  onCancel: () => void;
  onOk: () => void;
  mode?: 'create' | 'updatePackage';
  skillId?: string;
}

export default function CreateSkillModal({
  onCancel,
  onOk,
  mode = 'create',
  skillId = '',
}: CreateSkillModalProps) {
  const microWidgetProps = useMicroWidgetProps();
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<any[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isCreateMode = mode === 'create';

  useEffect(() => {
    if (!isCreateMode) {
      return;
    }

    const fetchCategoryOptions = async () => {
      try {
        const data = await getOperatorCategory();
        setCategoryOptions(data || []);
        const defaultCategory =
          data?.find((item: any) => item?.name === '未分类')?.category_type ?? data?.[0]?.category_type ?? '';
        setCategory(defaultCategory);
      } catch (error) {
        console.error(error);
      }
    };

    fetchCategoryOptions();
  }, [isCreateMode]);

  const getImportType = (file?: File) => {
    if (!file) {
      return null;
    }

    const lowerCaseName = file.name.toLowerCase();
    if (lowerCaseName.endsWith('.zip')) {
      return 'zip';
    }

    if (lowerCaseName === 'skill.md') {
      return 'content';
    }

    return null;
  };

  const handleConfirm = async () => {
    const currentFile = fileList[0]?.originFileObj;

    if (isCreateMode && !category) {
      message.info(intl.get('skill.selectCategory'));
      return;
    }

    if (!currentFile) {
      message.info(intl.get('skill.selectFile'));
      return;
    }

    const importType = getImportType(currentFile);
    if (!importType) {
      message.info(intl.get('skill.unsupportedFile'));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('file_type', importType);

      if (isCreateMode) {
        formData.append('category', category);
        await postSkill(formData);
      } else {
        await putSkillPackage(skillId, formData);
      }

      message.success(intl.get(isCreateMode ? 'skill.importSuccess' : 'skill.updatePackageSuccess'));
      onOk();
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBeforeUpload: UploadProps['beforeUpload'] = file => {
    if (!getImportType(file as File)) {
      message.info(intl.get('skill.unsupportedFile'));
      return Upload.LIST_IGNORE;
    }

    return false;
  };

  return (
    <Modal
      open
      centered
      width={640}
      title={intl.get(isCreateMode ? 'skill.importTitle' : 'skill.updatePackageTitle')}
      okText={intl.get('adminManagement.confirm')}
      cancelText={intl.get('adminManagement.cancel')}
      maskClosable={false}
      confirmLoading={submitting}
      okButtonProps={{ className: 'dip-w-74' }}
      cancelButtonProps={{ className: 'dip-w-74' }}
      onCancel={onCancel}
      onOk={handleConfirm}
      getContainer={() => microWidgetProps.container}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          <OkBtn />
          <CancelBtn />
        </>
      )}
    >
      <Form layout="vertical">
        {isCreateMode && (
          <Form.Item label={intl.get('skill.category')} required>
            <Select
              value={category}
              placeholder={intl.get('skill.selectCategory')}
              options={categoryOptions?.map((item: any) => ({
                label: item.name,
                value: item.category_type,
              }))}
              onChange={setCategory}
            />
          </Form.Item>
        )}
        <Form.Item label={intl.get('skill.file')} required>
          <Dragger
            accept=".zip,.md"
            maxCount={1}
            beforeUpload={handleBeforeUpload}
            fileList={fileList}
            onChange={({ fileList: nextFileList }) => setFileList(nextFileList.slice(-1))}
          >
            <div style={{ height: 206 }} className="dip-flex-column-center dip-gap-8">
              <CloudUploadOutlined className="dip-font-24" />
              <p style={{ color: 'rgb(102, 102, 102)' }}>{intl.get('skill.uploadTip')}</p>
            </div>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
