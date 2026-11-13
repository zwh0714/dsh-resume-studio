# Changelog

## [0.5.0] - 2026-11-12

### Added

- 新增 `paragraph` 模块，用于个人简介、自我评价这类整段文字，渲染为 `<p>` 与 Word 段落，不再作为列表项；支持空行分段与 `**加粗**`
- `kind` 无法识别时按字段结构推断（有 `items` 用条目式、有 `text` 用段落、有 `bullets` 用列表），不再抛错；原始值记录在 `declaredKind`，由 `kind` 规则以 `info` 级别说明
- `meta.theme`，用于在预设基础上调整外观：
  - 颜色：`accent` / `text` / `muted` / `band` / `rule` / `name`
  - `font`、`bodySize`（8–16pt）、`lineHeight`（0.85–1.6）、`sectionStyle`（`rule` / `tracked` / `bar`）
  - 调整 `bodySize` 时其余字号与行高按同一比例缩放
  - 取值非法的项被丢弃并回落到预设值
- `tests/schema.test.mjs`（23 个用例）
- 在线试用页增加主色、字号与分区样式控件

### Changed

- `normalize()` 改为幂等；`declaredKind` 在二次归一化时保留（`checkResume` 会再次归一化）
- `applyTheme()` 在合并前调用 `normalizeTheme()`，接受带 `#` 的色值
- `examples/` 两份示例各增加一个 `paragraph` 模块
- `tools/verify-playground.mjs` 覆盖范围扩大到 108 项（2 份示例 × 3 版式 × 2 纸张 × 3 组主题）
- `SKILL.md` 增加 `paragraph` 与 `list` 的选用说明和主题参数表
- 测试数 65 → 88

### Fixed

- `eachBullet`、`estimateWeights`、`date` 与 `empty` 检查在遇到 `paragraph` 模块时访问未定义的 `s.items` 导致崩溃
- 段落中的加粗字符计入加粗占比

## [0.4.0] - 2026-11-12

### Added

- 新增系统 LibreOffice 兜底。转换引擎集中到 `lib/convert.js`，按 DSH LibreOffice Kit、系统 `soffice`、无引擎三级选择；`soffice` 使用独立 `UserInstallation` profile，避免与已打开的实例冲突。可用 `RESUME_SOFFICE` 或 `SOFFICE_PATH` 指定路径，`dsh-resume engine` 查看当前引擎
- 新增零安装在线试用页 `docs/index.html`，由 `tools/build-playground.mjs` 将浏览器可运行的模块内联为单文件；`tools/verify-playground.mjs` 校验其输出与 Node 渲染器逐字节一致
- 新增 `meta.pageSize`，支持 `A4` 与 `Letter`，HTML 的 `@page`、页面尺寸与 DOCX 的 `w:pgSz` 同步切换
- `meta.lang` 生效：此前该字段存在但不影响输出。现在会切换骨架字段名、模块标题、`<html lang>`、文档标题、冒号全半角、页码文案与产物文件名（`<姓名>-简历` / `<Name>-Resume`）
- 新增英文骨架：`init --lang en`、`resume_init({ lang: 'en' })`
- 新增跨平台字体回退链，可用 `meta.font` 覆盖正文字体
- 新增 `examples/`，中英文各一份可直接渲染的示例简历
- 新增 `README.en.md`
- 新增 `tests/i18n.test.mjs`（16 个用例）、`tests/convert.test.mjs`（6 个）、`tests/pdf.test.mjs`（3 个，无引擎时跳过）

### Changed

- `cli init` 与 `resume_init` 共用 `lib/skeleton.js`，不再各自维护一份骨架
- 新增 `lib/locale.js`，集中管理面向用户的固定文案
- 删除 `lib/pdf.js`，其职责并入 `lib/convert.js`
- `resume_render` 返回值增加 `engine` 字段；`resume_init` 返回值增加 `lang` 与 `pageSize`
- 测试数 40 → 65

### Fixed

- 英文简历被误报缺少电话或邮箱：联系方式改为同时识别标签名与字段值
- `Present`、`Current`、`Now` 被判为时间格式不统一
- 英文 `Education` 模块被要求填写内容
- 英文弱动词（`responsible for`、`assisted` 等）纳入 `verbs` 检查；英文变化类动词同样要求给出数字

### Known limitations

- Word 与 LibreOffice 的分页存在 ±1–3% 差异，以「不超过 N 页」为目标
- 系统 `soffice` 分支未在 CI 覆盖（CI 环境没有 LibreOffice），仅测试了引擎探测与错误路径

## [0.3.1] - 2026-10-20

### Added

- **超页时给出「该压哪一块」的建议**：`pages` 体检项现在带 `hints` 数组，包括行距已压到多少、还差几页、按当前行距一页约多少行、至少得减多少行、篇幅最大的模块及其占比、最占篇幅的三个条目、项目介绍合计可省多少行，以及固定的处理顺序（删形容词 → 压最旧经历 → 合并模块 → 删经历前征得同意）
- 新增 `estimateWeights()` / `estimateLines()` / `visualWidth()` / `pageHints()` 四个可单独调用的估算函数
- 新增 `tests/pages.test.mjs`

### Changed

- `lint()` 接受 `compression: { attempts, lineSpacing, linesPerPage, charsPerLine }`；没传时只按字符宽度估算，不编造行距信息
- `api.js` 用版式参数（页边距、正文字号、header 形态）换算出每页行数与每行字数，让建议贴合实际版式而不是拍脑袋
- 超页文案改为「实际 3 页，目标 1 页，超出 2 页」，消除「超过目标 1 页」的歧义

## [0.3.0] - 2026-10-20

### Added

- `resume_import` 工具：把已有的 `.doc` / `.docx` / `.odt` 简历读成纯文本，复用 LibreOffice Kit（`doc → txt`），不需要 Word COM。CLI 同步新增 `import` 命令
- `checkCompoundFileIntegrity()`：调用引擎之前先判老版 Office 复合文档是否被截断，直接报「尾部少了 N 字节，请另存为 .docx」，而不是让引擎抛 `invalid-document`

### Changed

- **数字规则改为「只在声称变化时要求证据」**：bullet 里出现提升/降低/优化/缩短等动词却没有数字才告警；纯功能描述与技能清单不再逐条告警；新增汇总规则（≥2 条声称变化且覆盖率 <50%）
- `meta.allowQualitative`：把这个开关设为 `true`，数字告警降级为 info，对应「没有数据可写、只做定性描述」的场景
- `resume_render` 直接返回 `issues` 明细，不再需要补一次 `resume_check`
- 加粗阈值统一为 **25%**（原代码按 30% 判，与 SKILL.md 自相矛盾）
- `stats` 新增 `claims` 与 `claimRatio`
- `SKILL.md` 增加「先判断输入形态」，明确旧简历走 `resume_import`，禁止手写解析器与 COM 转换

### Fixed

- 实际生效后 `tests/core.test.mjs` 的 numbers 用例改为断言「声称变化但无数字」
- 工具数从 5 个增加到 6 个

## [0.2.0] - 2026-10-20

### Added

- `resume_guide` 工具：插件自带写作指南（访谈流程、写作与加粗规则、压页与产物说明），可用 `topic` 只取一节；装插件即可，无需另外安装 `SKILL.md`

### Changed

- README 重写：以「怎么装、装完怎么用」为主线，删去示例数据与冗余说明
- 工具数从 4 个增加到 5 个

## [0.1.1] - 2026-10-20

### Fixed

- 声明 `inject = ['tools']`。修复安装后无法激活、报 `cannot get property "tools" without inject` 的问题（cordis 要求先声明依赖的服务）
- `apply` 改为同步注册：`defineTool` 在模块加载阶段解析，避免异步注册造成的时序问题

## [0.1.0] - 2026-10-20

首个公开版本。

### Added

- 三套版式：`classic`（经典蓝线）、`minimal`（极简黑白）、`sidebar`（侧栏信息带）
- 一份 JSON 同时输出 HTML / DOCX / PDF，DOCX 为印刷母版，PDF 由它转换
- 自动压页：按 `maxPages` 逐轮收紧行距并回读页数（最多 7 轮）
- 写作体检：数字覆盖率、加粗占比、条目长度、时间格式、模块数量、页数
- 四个 DSH 工具：`resume_init` / `resume_render` / `resume_check` / `resume_templates`
- CLI：`render` / `check` / `templates` / `init`
- LibreOffice Kit 自动探测（环境变量 → DSH 安装目录 → 平台常见路径）
- `SKILL.md`：访谈套路、加粗规则、交付流程
- 14 个单元/集成测试

### Known limitations

- Word 与 LibreOffice 分页存在 ±1–3% 差异，以「不超过 N 页」为目标
- 字体不嵌入，目标机器缺字体时建议交付 PDF
