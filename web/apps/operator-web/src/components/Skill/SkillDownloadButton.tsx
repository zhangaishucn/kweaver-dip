import { message } from 'antd';
import { downloadSkill, downloadSkillManagement } from '@/apis/agent-operator-integration';
import { downloadFile, getFilenameFromContentDisposition } from '@/utils/file';

interface SkillDownloadButtonProps {
  skillId: string;
  name?: string;
  label?: string;
  management?: boolean;
}

export default function SkillDownloadButton({
  skillId,
  name = 'skill',
  label = '导出',
  management = false,
}: SkillDownloadButtonProps) {
  const handleDownload = async () => {
    try {
      const response = await (management ? downloadSkillManagement(skillId) : downloadSkill(skillId));
      const filename =
        getFilenameFromContentDisposition(response?.headers?.['content-disposition']) || `${name}.zip`;
      downloadFile(response.data, filename, { type: 'application/zip' });
      message.success('导出成功');
    } catch (error: any) {
      if (error?.description) {
        message.error(error.description);
      }
    }
  };

  return <div onClick={handleDownload}>{label}</div>;
}
