import { useEffect, useMemo, useState } from 'react';
import intl from 'react-intl-universal';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Layout, Modal, Skeleton, Tree, Typography, message } from 'antd';
import { ArrowsAltOutlined, FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import emptyImage from '@/assets/images/empty2.png';
import '@/components/Operator/style.less';
import styles from './SkillDetail.module.less';
import {
  getSkillContent,
  getSkillInfo,
  getSkillManagementContent,
  getSkillMarketInfo,
  readSkillFile,
  readSkillManagementFile,
} from '@/apis/agent-operator-integration';
import { postResourceOperation } from '@/apis/authorization';
import DetailHeader from '@/components/OperatorList/DetailHeader';
import { OperateTypeEnum, OperatorTypeEnum, PermConfigTypeEnum } from '@/components/OperatorList/types';
import {
  buildSkillTreeData,
  fetchRemoteBlob,
  fetchRemoteText,
  findSkillTreeNode,
  type SkillFileSummary,
  type SkillTreeNode,
  unwrapSkillResponse,
} from './shared';

const { Sider, Content } = Layout;
const { Paragraph, Text } = Typography;
type PreviewType = 'markdown' | 'text' | 'image' | 'unsupported';

const markdownExtensions = new Set(['md', 'markdown', 'mdown', 'mkd']);
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const textExtensions = new Set([
  'txt',
  'json',
  'yaml',
  'yml',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'less',
  'scss',
  'html',
  'xml',
  'py',
  'java',
  'go',
  'rs',
  'sh',
  'sql',
  'log',
  'toml',
  'ini',
  'conf',
  'env',
]);

const getFileExtension = (filePath = '') => filePath.split('.').pop()?.toLowerCase() || '';

const resolvePreviewType = (node?: SkillTreeNode): PreviewType => {
  const relPath = node?.rel_path || 'SKILL.md';
  const mimeType = (node?.mime_type || (relPath === 'SKILL.md' ? 'text/markdown' : '')).toLowerCase();
  const extension = getFileExtension(relPath);

  if (mimeType === 'text/markdown' || markdownExtensions.has(extension)) {
    return 'markdown';
  }

  if (mimeType.startsWith('image/') || imageExtensions.has(extension)) {
    return 'image';
  }

  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    textExtensions.has(extension)
  ) {
    return 'text';
  }

  return 'unsupported';
};

const markdownComponents = {
  a: (props: React.ComponentProps<'a'>) => <a {...props} target="_blank" rel="noreferrer" />,
  img: (props: React.ComponentProps<'img'>) => <img {...props} alt={props.alt ?? ''} loading="lazy" />,
};

export default function SkillDetail() {
  const [searchParams] = useSearchParams();
  const skillId = searchParams.get('skill_id') || '';
  const action = searchParams.get('action') || '';
  const [skillInfo, setSkillInfo] = useState<any>({});
  const [permissionCheckInfo, setPermissionCheckInfo] = useState<Array<PermConfigTypeEnum>>();
  const [treeData, setTreeData] = useState<SkillTreeNode[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('file:SKILL.md');
  const [contentManifest, setContentManifest] = useState<any>({});
  const [contentValue, setContentValue] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isViewerExpanded, setIsViewerExpanded] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [detailLoading, setDetailLoading] = useState(true);
  const isMarketView = action === OperateTypeEnum.View;

  const selectedNode = useMemo(() => findSkillTreeNode(treeData, selectedKey), [treeData, selectedKey]);
  const previewType = useMemo(() => resolvePreviewType(selectedNode), [selectedNode]);
  const canExpandViewer = selectedNode?.nodeType !== 'directory' && previewType !== 'unsupported';

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    fetchSkillInfo();
    fetchPermission();
    fetchSkillContent();
  }, [skillId, action]);

  useEffect(() => {
    if (!selectedNode && selectedKey !== 'file:SKILL.md') {
      return;
    }

    if (!contentManifest?.url && !contentManifest?.content) {
      return;
    }

    loadSelectedContent();
  }, [selectedNode, selectedKey, contentManifest?.content, contentManifest?.url, skillId, action]);

  const fetchSkillInfo = async () => {
    setDetailLoading(true);
    try {
      const response = isMarketView ? await getSkillMarketInfo(skillId) : await getSkillInfo(skillId);
      setSkillInfo(unwrapSkillResponse(response));
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchSkillContent = async () => {
    try {
      const response = isMarketView ? await getSkillContent(skillId) : await getSkillManagementContent(skillId);
      const payload = unwrapSkillResponse<any>(response);
      const files = Array.isArray(payload?.files) ? (payload.files as SkillFileSummary[]) : [];
      setContentManifest(payload);
      setTreeData(buildSkillTreeData(files));
      setSelectedKey('file:SKILL.md');
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    }
  };

  const fetchPermission = async () => {
    try {
      const data = await postResourceOperation({
        method: 'GET',
        resources: [
          {
            id: skillId,
            type: OperatorTypeEnum.Skill,
          },
        ],
      });
      setPermissionCheckInfo(data?.[0]?.operation);
    } catch (error: any) {
      console.error(error);
    }
  };

  const loadSelectedContent = async () => {
    const targetNode = selectedNode || {
      key: 'file:SKILL.md',
      rel_path: 'SKILL.md',
      nodeType: 'file',
      title: 'SKILL.md',
      path: 'SKILL.md',
    };

    if (targetNode.nodeType === 'directory') {
      setContentError('');
      setContentValue('');
      setPreviewUrl('');
      return;
    }

    setContentLoading(true);
    setContentError('');
    setContentValue('');
    try {
      let url = '';
      if (targetNode.rel_path === 'SKILL.md') {
        url = contentManifest?.url;
      } else {
        const fileResponse = isMarketView
          ? await readSkillFile(skillId, { rel_path: targetNode.rel_path })
          : await readSkillManagementFile(skillId, { rel_path: targetNode.rel_path });
        url = unwrapSkillResponse<any>(fileResponse)?.url;
      }

      if (!url && targetNode.rel_path === 'SKILL.md' && contentManifest?.content) {
        setPreviewUrl('');
        setContentValue(contentManifest.content);
        return;
      }

      if (!url) {
        throw new Error(intl.get('skill.fileUrlMissing'));
      }

      if (previewType === 'markdown' || previewType === 'text') {
        const text = await fetchRemoteText(url);
        setPreviewUrl('');
        setContentValue(text);
      } else if (previewType === 'image') {
        const blob = await fetchRemoteBlob(url);
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        setPreviewUrl('');
      }
    } catch (error: any) {
      setContentValue('');
      setPreviewUrl('');
      setContentError(error?.description || error?.message || intl.get('skill.fileLoadFailed'));
    } finally {
      setContentLoading(false);
    }
  };

  const renderPreviewEmpty = (description: string) => (
    <div className={styles.previewEmpty}>
      <Empty image={<img src={emptyImage} alt="empty" className={styles.emptyImage} />} description={description} />
    </div>
  );

  const viewerContent =
    selectedNode?.nodeType === 'directory' ? (
      renderPreviewEmpty(intl.get('skill.previewSelectFile'))
    ) : (
      <Skeleton active loading={detailLoading || contentLoading}>
        {contentError ? (
          <Alert type="error" showIcon message={contentError} />
        ) : (
          <>
            {previewType === 'markdown' ? (
              <div className={styles.markdown}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {contentValue || ''}
                </ReactMarkdown>
              </div>
            ) : null}
            {previewType === 'text' ? (
              <Paragraph className={styles.code}>
                <pre>{contentValue || ''}</pre>
              </Paragraph>
            ) : null}
            {previewType === 'image' ? (
              <div className={styles.mediaPreview}>
                {previewUrl ? (
                  <img className={styles.mediaImage} src={previewUrl} alt={selectedNode?.title || 'preview'} />
                ) : (
                  <Empty description={intl.get('skill.imageLoading')} />
                )}
              </div>
            ) : null}
            {previewType === 'unsupported' ? renderPreviewEmpty(intl.get('skill.previewUnsupported')) : null}
          </>
        )}
      </Skeleton>
    );

  const viewerPanel = (
    <div className={`${styles.viewer} ${isViewerExpanded ? styles.viewerExpanded : ''}`}>
      <div className={styles.viewerHeader}>
        <div className={styles.viewerTitle}>
          <Text strong className={styles.viewerTitleText} title={selectedNode?.title || ''}>
            {selectedNode?.title || ''}
          </Text>
        </div>
        <div className={styles.viewerActions}>
          {canExpandViewer && !isViewerExpanded && (
            <Button
              type="text"
              className={styles.expandButton}
              icon={<ArrowsAltOutlined />}
              onClick={() => setIsViewerExpanded(value => !value)}
            />
          )}
        </div>
      </div>
      {viewerContent}
    </div>
  );

  return (
    <div className="operator-detail">
      <DetailHeader
        type={OperatorTypeEnum.Skill}
        detailInfo={skillInfo}
        fetchInfo={() => {
          fetchSkillInfo();
          fetchSkillContent();
        }}
        permissionCheckInfo={permissionCheckInfo}
      />
      <Layout className={styles.layout}>
        <Sider width={360} className="operator-detail-sider">
          <div className="operator-detail-sider-content">
            <Text strong>
              <FolderOpenOutlined /> {intl.get('skill.fileList')}
            </Text>
          </div>
          <div className={styles.tree}>
            {treeData.length ? (
              <Tree
                blockNode
                showIcon
                defaultExpandAll
                selectedKeys={[selectedKey]}
                treeData={treeData.map(node => ({
                  ...node,
                  title: (
                    <span className={styles.treeNodeTitle} title={node.title}>
                      <span className={styles.treeNodeTitleText}>{node.title}</span>
                    </span>
                  ),
                  icon: node.nodeType === 'directory' ? <FolderOpenOutlined /> : <FileTextOutlined />,
                }))}
                onSelect={keys => {
                  if (keys[0]) {
                    setSelectedKey(String(keys[0]));
                  }
                }}
              />
            ) : (
              <Empty
                image={<img src={emptyImage} alt="empty" style={{ width: 128 }} />}
                description={intl.get('skill.noFile')}
              />
            )}
          </div>
        </Sider>
        <Content className={styles.content}>{viewerPanel}</Content>
      </Layout>
      <Modal
        open={isViewerExpanded}
        onCancel={() => setIsViewerExpanded(false)}
        footer={null}
        width="80vw"
        centered
        destroyOnHidden={false}
      >
        <div className={styles.viewerModalBody}>{viewerPanel}</div>
      </Modal>
    </div>
  );
}
