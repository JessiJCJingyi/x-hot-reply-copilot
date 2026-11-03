# Chrome Web Store Privacy 表单草案

提交前必须以发布包实际行为复核，确保商店表单、隐私政策和代码完全一致。

## Single purpose

帮助用户在 X/Twitter 当前页面发现近期高热度帖子，并根据用户提供的产品或个人资料生成可编辑的回复草稿。

## Permission justifications

### storage

保存用户主动填写的模型配置、产品或个人资料、回复偏好和界面状态，使扩展可在后续会话中恢复设置。

### x.com / twitter.com host access

读取当前页面已加载的公开帖子文字、作者、发布时间和公开互动数字，用于本地热帖排序；在用户点击“插入”后把已选择的草稿放入回复编辑框。扩展不会自动发布内容。

### Model API host access

仅在用户主动点击生成或资料导入时，向用户配置的 HTTPS 模型 API 发送完成该功能所需的帖子内容和用户资料。

### Optional public website access

仅在用户主动提供并确认 URL 后读取该公开 HTTPS 页面，以提取产品或个人资料。发布前应把任意网站权限改为运行时可选权限。

## Data categories handled

- Website content：是。处理 X 帖子和用户主动提供的公开网页内容。
- Web browsing activity：是。只处理当前 X 页面以及用户主动提供的资料 URL，不用于广告、画像交易或与核心功能无关的分析。
- User-generated content：是。处理用户填写的产品、Bio、语气和禁用表达。
- Authentication information：是。用户自行提供第三方模型 API Key；发布版必须仅保存在设备本地，不同步到开发者服务器。
- Personally identifiable information：可能。用户可在 Bio 或社媒资料中主动填写姓名等信息。

## Certifications

- 不出售或转让用户数据。
- 不将用户数据用于与单一目的无关的用途。
- 不将用户数据用于信贷、广告定向或其他被禁止用途。
- 不使用或传输数据进行人工广告画像。
- 所有远程传输均使用 HTTPS。
- 开发者不运营接收用户数据的后端。

## Pre-submit blockers

- [x] API Key 从 `chrome.storage.sync` 迁移到 `chrome.storage.local`。
- [x] `https://*/*` 改为最小必要的固定域名与运行时可选权限。
- [x] 插件内首次使用前展示数据流说明并要求用户主动确认。
- [x] 对任意公开网页和自定义 API 域名的访问仅在用户操作后申请。
- [ ] 逐项核对 Developer Dashboard 的数据披露与本文件一致。
