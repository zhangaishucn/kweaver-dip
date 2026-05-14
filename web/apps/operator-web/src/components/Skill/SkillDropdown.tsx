import { useState } from 'react';
import intl from 'react-intl-universal';
import { Button, Dropdown, Menu, message } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { delSkill, putSkillStatus } from '@/apis/agent-operator-integration';
import { postResourceOperation } from '@/apis/authorization';
import { useMicroWidgetProps } from '@/hooks';
import { confirmModal } from '@/utils/modal';
import PermConfigMenu from '@/components/OperatorList/PermConfigMenu';
import { PublishedPermModal } from '@/components/OperatorList/PublishedPermModal';
import {
  OperateTypeEnum,
  OperatorStatusType,
  OperatorTypeEnum,
  PermConfigTypeEnum,
} from '@/components/OperatorList/types';
import CreateSkillModal from './CreateSkillModal';
import EditSkillModal from './EditSkillModal';
import SkillDownloadButton from './SkillDownloadButton';

const SkillDropdown: React.FC<{ params: any; fetchInfo: () => void }> = ({ params, fetchInfo }) => {
  const { activeTab, record } = params;
  const navigate = useNavigate();
  const microWidgetProps = useMicroWidgetProps();
  const [permissionCheckInfo, setPermissionCheckInfo] = useState<Array<PermConfigTypeEnum>>();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [updatePackageOpen, setUpdatePackageOpen] = useState(false);

  const handlePreview = (type: string) => {
    navigate(`/skill-detail?skill_id=${record?.skill_id}&action=${type}`);
  };

  const handleStatus = async (status: string, successText: string) => {
    try {
      await putSkillStatus(record?.skill_id, { status });
      message.success(successText);
      fetchInfo?.();
      if (status === OperatorStatusType.Published && permissionCheckInfo?.includes(PermConfigTypeEnum.Authorize)) {
        PublishedPermModal({ record, activeTab: OperatorTypeEnum.Skill }, microWidgetProps);
      }
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await delSkill(record?.skill_id);
      message.success(intl.get('action.deleteSuccess'));
      fetchInfo?.();
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    }
  };

  const showDeleteConfirm = () => {
    confirmModal({
      title: intl.get('skill.deleteAction'),
      content: intl.get('skill.confirmDeleteAction'),
      onOk() {
        handleDelete();
      },
      onCancel() {},
    });
  };

  const showOfflineConfirm = () => {
    confirmModal({
      title: intl.get('skill.unpublishAction'),
      content: intl.get('skill.confirmUnpublishAction'),
      onOk() {
        handleStatus(OperatorStatusType.Offline, intl.get('action.unpublishSuccess'));
      },
      onCancel() {},
    });
  };

  const resourceOperation = async () => {
    try {
      const data = await postResourceOperation({
        method: 'GET',
        resources: [
          {
            id: record?.skill_id,
            type: activeTab,
          },
        ],
      });
      setPermissionCheckInfo(data?.[0]?.operation);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleActionSuccess = () => {
    setEditModalOpen(false);
    setUpdatePackageOpen(false);
    fetchInfo?.();
  };

  return (
    <>
      <Dropdown
        trigger={['click']}
        overlay={
          <Menu>
            {permissionCheckInfo?.includes(PermConfigTypeEnum.View) && (
              <Menu.Item onClick={() => handlePreview(OperateTypeEnum.Edit)}>
                {intl.get('adminManagement.view')}
              </Menu.Item>
            )}

            {permissionCheckInfo?.includes(PermConfigTypeEnum.Modify) && (
              <Menu.Item onClick={() => setUpdatePackageOpen(true)}>{intl.get('skill.updatePackageAction')}</Menu.Item>
            )}

            {permissionCheckInfo?.includes(PermConfigTypeEnum.Modify) && (
              <Menu.Item onClick={() => setEditModalOpen(true)}>{intl.get('skill.editAction')}</Menu.Item>
            )}

            {permissionCheckInfo?.includes(PermConfigTypeEnum.View) && (
              <Menu.Item>
                <SkillDownloadButton skillId={record?.skill_id} name={record?.name} management />
              </Menu.Item>
            )}

            {record?.status !== OperatorStatusType.Published &&
              permissionCheckInfo?.includes(PermConfigTypeEnum.Publish) && (
                <Menu.Item
                  onClick={() => handleStatus(OperatorStatusType.Published, intl.get('action.publishSuccess'))}
                >
                  {intl.get('action.publish')}
                </Menu.Item>
              )}

            {record?.status === OperatorStatusType.Published &&
              permissionCheckInfo?.includes(PermConfigTypeEnum.Unpublish) && (
                <Menu.Item onClick={showOfflineConfirm}>{intl.get('action.unpublish')}</Menu.Item>
              )}

            {permissionCheckInfo?.includes(PermConfigTypeEnum.Authorize) && (
              <Menu.Item>
                <PermConfigMenu params={{ record, activeTab: OperatorTypeEnum.Skill }} />
              </Menu.Item>
            )}

            {record?.status !== OperatorStatusType.Published &&
              record?.status !== OperatorStatusType.Editing &&
              permissionCheckInfo?.includes(PermConfigTypeEnum.Delete) && (
                <Menu.Item className="operator-menu-delete" onClick={showDeleteConfirm}>
                  {intl.get('action.delete')}
                </Menu.Item>
              )}
          </Menu>
        }
      >
        <Button type="text" icon={<EllipsisOutlined />} onClick={resourceOperation} />
      </Dropdown>

      {editModalOpen && (
        <EditSkillModal skillInfo={record} onCancel={() => setEditModalOpen(false)} onOk={handleActionSuccess} />
      )}

      {updatePackageOpen && (
        <CreateSkillModal
          mode="updatePackage"
          skillId={record?.skill_id}
          onCancel={() => setUpdatePackageOpen(false)}
          onOk={handleActionSuccess}
        />
      )}
    </>
  );
};

export default SkillDropdown;
