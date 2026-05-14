import { useMemo, useState, type FC } from 'react';
import { Button, Dropdown, message } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';
import intl from 'react-intl-universal';
import { putSkillStatus } from '@/apis/agent-operator-integration';
import { confirmModal } from '@/utils/modal';
import { useMicroWidgetProps } from '@/hooks';
import PermConfigMenu from '@/components/OperatorList/PermConfigMenu';
import { PublishedPermModal } from '@/components/OperatorList/PublishedPermModal';
import { OperatorStatusType, OperatorTypeEnum, PermConfigTypeEnum } from '@/components/OperatorList/types';
import CreateSkillModal from './CreateSkillModal';
import EditSkillModal from './EditSkillModal';

enum SkillActionKeyEnum {
  Edit = 'Edit',
  UpdatePackage = 'UpdatePackage',
  Publish = 'Publish',
  Unpublish = 'Unpublish',
  Authorize = 'Authorize',
}

const getSkillButtons = (permissionCheckInfo: Array<PermConfigTypeEnum>, detailInfo: any) => {
  const status = detailInfo?.status;
  const [canEdit, canPublish, canUnpublish, canAuthorize] = [
    permissionCheckInfo?.includes(PermConfigTypeEnum.Modify),
    status !== OperatorStatusType.Published && permissionCheckInfo?.includes(PermConfigTypeEnum.Publish),
    status === OperatorStatusType.Published && permissionCheckInfo?.includes(PermConfigTypeEnum.Unpublish),
    permissionCheckInfo?.includes(PermConfigTypeEnum.Authorize),
  ];

  const btns = [
    {
      key: SkillActionKeyEnum.Edit,
      label: intl.get('skill.editAction'),
      visible: canEdit,
    },
    {
      key: SkillActionKeyEnum.UpdatePackage,
      label: intl.get('skill.updatePackageAction'),
      visible: canEdit,
    },
    {
      key: SkillActionKeyEnum.Publish,
      label: '发布',
      visible: canPublish,
    },
    {
      key: SkillActionKeyEnum.Unpublish,
      label: '下架',
      visible: canUnpublish,
    },
    {
      key: SkillActionKeyEnum.Authorize,
      label: <PermConfigMenu params={{ record: detailInfo, activeTab: OperatorTypeEnum.Skill }} />,
      visible: canAuthorize,
    },
  ].filter(item => item.visible);

  return btns.length > 3 ? [btns.slice(0, 2).toReversed(), btns.slice(2)] : [btns.toReversed(), []];
};

const SkillDetailButton: FC<{
  detailInfo: any;
  fetchInfo: () => void;
  permissionCheckInfo: Array<PermConfigTypeEnum>;
  goBack: () => void;
}> = ({ detailInfo, fetchInfo, permissionCheckInfo }) => {
  const microWidgetProps = useMicroWidgetProps();
  const [buttonLoading, setButtonLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [updatePackageOpen, setUpdatePackageOpen] = useState(false);

  const [otherButtons, moreButtons] = useMemo(
    () => getSkillButtons(permissionCheckInfo, detailInfo),
    [permissionCheckInfo, detailInfo]
  );

  const handleStatus = async (status: string, successText: string) => {
    setButtonLoading(true);
    try {
      await putSkillStatus(detailInfo?.skill_id, { status });
      message.success(successText);
      fetchInfo?.();
      if (status === OperatorStatusType.Published && permissionCheckInfo?.includes(PermConfigTypeEnum.Authorize)) {
        PublishedPermModal({ record: detailInfo, activeTab: OperatorTypeEnum.Skill }, microWidgetProps);
      }
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    } finally {
      setButtonLoading(false);
    }
  };

  const showOfflineConfirm = () => {
    confirmModal({
      title: '下架Skill',
      content: '下架后，引用了该Skill的智能体或工作流会失效，此操作不可撤回。',
      onOk() {
        handleStatus(OperatorStatusType.Offline, '下架成功');
      },
      onCancel() {},
    });
  };

  const handleActionSuccess = () => {
    setEditModalOpen(false);
    setUpdatePackageOpen(false);
    fetchInfo?.();
  };

  const handleClick = (item: any) => {
    switch (item.key) {
      case SkillActionKeyEnum.Edit:
        setEditModalOpen(true);
        break;
      case SkillActionKeyEnum.UpdatePackage:
        setUpdatePackageOpen(true);
        break;
      case SkillActionKeyEnum.Publish:
        handleStatus(OperatorStatusType.Published, '发布成功');
        break;
      case SkillActionKeyEnum.Unpublish:
        showOfflineConfirm();
        break;
      default:
        break;
    }
  };

  return (
    <>
      {moreButtons?.length > 0 && (
        <Dropdown
          menu={{
            items: moreButtons as any[],
            onClick: handleClick,
          }}
        >
          <Button icon={<EllipsisOutlined />} />
        </Dropdown>
      )}

      {otherButtons.map(item =>
        typeof item.label === 'string' || item.key === SkillActionKeyEnum.Authorize ? (
          <Button
            key={item.key}
            type={item.key === SkillActionKeyEnum.Unpublish ? 'default' : item.key === SkillActionKeyEnum.Publish ? 'primary' : 'default'}
            color={item.key === SkillActionKeyEnum.Unpublish ? 'danger' : undefined}
            variant={item.key === SkillActionKeyEnum.Publish || item.key === SkillActionKeyEnum.Unpublish ? 'filled' : undefined}
            loading={
              buttonLoading &&
              [SkillActionKeyEnum.Publish, SkillActionKeyEnum.Unpublish].includes(item.key as SkillActionKeyEnum)
            }
            onClick={() => handleClick(item)}
          >
            {item.label}
          </Button>
        ) : (
          <span key={item.key} onClick={() => handleClick(item)}>
            {item.label}
          </span>
        )
      )}

      {editModalOpen && (
        <EditSkillModal skillInfo={detailInfo} onCancel={() => setEditModalOpen(false)} onOk={handleActionSuccess} />
      )}

      {updatePackageOpen && (
        <CreateSkillModal
          mode="updatePackage"
          skillId={detailInfo?.skill_id}
          onCancel={() => setUpdatePackageOpen(false)}
          onOk={handleActionSuccess}
        />
      )}
    </>
  );
};

export default SkillDetailButton;
