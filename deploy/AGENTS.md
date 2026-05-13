# 部署指南

## 目录结构

```
.
├── openclaw-extensions/dip   # OpenClaw DIP 插件和技能
├── release-manifests/        # 发布和环境变量配置
│   └── <VERSION>/            # 发布的版本
│      └── kweaver-dip.yaml   # KWeaver DIP 发布的版本配置
```

### kweaver-dip.yaml

`kweaver-dip.yaml` 包含执行 `./deploy.sh kweaver-dip install` 命令会安装部署的 Helm Chart 列表。

kweaver-dip.yaml 的关键 Schema 如下：

```yaml
source:
  helmRepoName: string      # Helm repo 名称
  helmRepoUrl: string       # Helm repo URL

dependencies:               # KWeaver DIP 产品依赖列表
  - product: string         # 依赖产品名，目前依赖 "isf" 和 "kweaver-core"
    version: string         # 依赖产品版本
    manifest: string        # 依赖 manifest 相对路径

releases:                   # release 名到 Helm chart 发布项的映射
  <releaseName>:
    chart: string           # Helm chart 名称
    version: string         # chart 版本
    stage: string           # 可选；当前看到 pre，用于预置/前置发布
    values: object          # 可选；传给 chart 的 values 覆盖
```
