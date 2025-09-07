# 项目背景与目标

## 背景

随着 AI 图像生成和编辑工具的普及，越来越多用户在日常创作、社交媒体、设计工作中使用 AI 图片。但几乎所有 AI 工具生成的图片都默认带有 水印或 Logo，这给用户使用带来了不便。

## 痛点

- 自媒体用户：需要无水印图片用于视频、文章封面。
- 设计师与创作者：想要清理素材再进行二次加工。
- 普通用户：仅想获得干净的壁纸或头像。

## 目标

- 短期（MVP）：提供一个基于浏览器的轻量化工具，实现 上传—框选—去水印—下载 的闭环体验。
- 中期（迭代）：逐步接入更强的算法与功能（自动检测、批量处理、移动端适配）。
- 长期：沉淀为一个有品牌认知的 AI 图片工具平台，探索 API/SaaS 化与商业化。

## 品牌与 SEO 策略

- 域名：removeaiwatermark.org  （精准匹配主关键词）
- 品牌：NoAIWatermark （传播、Logo、UI 展示用）

### SEO 关键词

- 主关键词：remove ai watermark
- 次关键词：remove ai logo
- 长尾词：remove ai watermark online / delete ai watermark from photo / free remove ai watermark

### SEO 布局

- H1 标题：Remove AI Watermark Online
- Title：Remove AI Watermark Online - Free Tool | NoAIWatermark
- Meta：Free online tool to remove AI watermark and logos. Upload, brush, erase, and download clean AI images instantly.
- FAQ Schema：支持 FAQPage 结构化数据

## 实施方案

以 nextjs SAAS 模板 shipany 为基础开发，shipany 文档见：https://docs.shipany.ai/zh

shipany组件开发文档见：https://docs.shipany.ai/zh/tutorials/new-components

## watermark-remover 组件【已实现 mvp 版本】

- 支持上传图片
- 支持选择消除算法
- 支持设置笔刷大小
- 支持设置 inpaint radius
- 支持撤销、擦除、清除画笔
- 支持生成结果在新的画布显示


