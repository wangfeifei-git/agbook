# 小说写作 AI Agent 工具技术方案草案

## 1. 文档目标

本文档用于定义小说写作 AI Agent 工具的技术实现方案，目标是支撑以下产品能力：

- 本地优先安装与运行
- OpenAI 兼容协议接入多模型
- 小说项目、设定、大纲、章节计划等结构化管理
- 基于章节生成规则的正文生成
- 审核与修订闭环
- 可持续扩展为多 Agent 工作流

本文档优先面向 MVP 和后续 1-2 个迭代阶段，不追求一次性覆盖全部高级能力。

---

## 2. 技术目标

技术方案需要满足以下目标：

1. 本地安装简单，不依赖复杂部署
2. 架构分层清晰，前后续扩展成本可控
3. 模型接入层统一，避免与单一厂商绑定
4. 创作流程结构化，而不是把全部能力塞进聊天框
5. 支持章节规则的配置、注入、执行、校验
6. 支持版本管理和后续一致性系统扩展

---

## 3. 总体架构建议

推荐采用如下架构：

1. 桌面壳：`Tauri`
2. 前端应用：`React + TypeScript`
3. 本地服务层：`Node.js`
4. 本地存储：`SQLite + 文件系统`
5. 模型网关层：`OpenAI-compatible provider adapter`
6. 工作流层：`Task Orchestrator`
7. 规则与审核层：`Rule Engine + Review Pipeline`

整体上建议采用“桌面客户端 + 本地服务内核”的模式，而不是把所有逻辑都塞进前端。

这样做的原因是：

- 前端更专注 UI 和交互
- 本地服务更适合承载模型调用、文件处理、任务编排
- 后续更容易加入任务队列、版本管理、规则引擎
- 如果未来要支持插件或本地模型，也更容易扩展

---

## 4. 分层设计

建议将系统拆分为 6 层。

## 4.1 表现层

即桌面客户端中的前端界面，负责：

- 小说项目导航
- 设定编辑
- 大纲编辑
- 章节计划配置
- 正文编辑与查看
- 审核结果展示
- 模型配置
- 任务状态显示

推荐技术：

- `React`
- `TypeScript`
- `Tailwind CSS`
- 状态管理：`Zustand`
- 数据请求：`TanStack Query`
- 编辑器：`Monaco Editor` 或 `TipTap`

---

## 4.2 应用服务层

位于本地服务内核中，负责承接前端发起的业务请求，并编排下层模块。

典型服务包括：

- `NovelService`
- `SettingService`
- `OutlineService`
- `ChapterPlanService`
- `DraftService`
- `ReviewService`
- `ModelConfigService`
- `WorkflowService`

这一层不直接操作 UI，也不直接耦合模型 SDK，而是负责业务逻辑聚合。

---

## 4.3 工作流编排层

这是本产品的核心技术层之一，用于把“生成一章”拆成明确步骤。

建议支持的工作流节点：

1. 读取小说项目
2. 收集章节计划
3. 读取章节生成规则
4. 选择相关设定与前文摘要
5. 生成章纲（可选）
6. 生成正文初稿
7. 执行审核
8. 输出修订建议
9. 自动修订或人工确认
10. 保存版本

推荐采用“任务流水线”设计，而不是把一切交给单次 prompt。

这样做的收益是：

- 输出更稳定
- 问题更容易定位
- 可以在每个步骤加入日志和错误处理
- 更适合批量生成和后续多 Agent 化

---

## 4.4 模型接入层

统一封装不同模型提供方，向上只暴露一致接口。

建议定义统一抽象：

- `listModels()`
- `testConnection()`
- `chat()`
- `streamChat()`
- `structuredChat()`

底层通过 Provider Adapter 适配不同供应商。

推荐首版支持：

- OpenAI 兼容 `chat/completions`
- 流式输出
- 基础 JSON 结构化输出

后续再扩展：

- `responses` 风格接口
- function/tool calling
- 多模态输入

---

## 4.5 数据持久层

建议采用混合存储：

- `SQLite`：保存结构化实体和关系数据
- 本地文件系统：保存 Markdown 草稿、导出内容、日志、快照

这样设计的优点：

- SQLite 适合查询和关系管理
- Markdown / JSON 文件适合内容可见、可迁移、可备份
- 兼顾性能、可维护性和用户可控性

---

## 4.6 规则与审核层

该层负责处理章节生成规则、审核规则和一致性校验逻辑。

建议拆成两类能力：

1. 生成前规则整理
2. 生成后结果审核

典型规则来源：

- 小说级规则
- 章节计划规则
- 用户临时附加规则
- 系统内置审核规则

---

## 5. 推荐技术栈

## 5.1 客户端

- `Tauri`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui` 或类似组件方案

优先选择 `Tauri` 的原因：

- 安装包体积更小
- 运行资源占用更低
- 本地能力足够支撑当前产品

如果后续需要更强的 Node 生态和桌面集成，也可以切换为 `Electron`，但首选仍建议 `Tauri + Node sidecar/local server`。

---

## 5.2 本地服务

- `Node.js`
- `Fastify` 或 `Express`
- `Zod` 用于请求和数据校验
- `better-sqlite3` 或同类 SQLite 驱动

推荐 `Fastify` 的原因：

- 结构清晰
- 性能好
- 插件化适中
- 适合作为本地 API 服务

---

## 5.3 数据与文档

- 数据库：`SQLite`
- 文件格式：`Markdown + JSON`
- 可选搜索：SQLite FTS 或后续引入本地检索组件

---

## 5.4 AI 接入

- 统一使用 `fetch` 或 HTTP Client 调用 OpenAI 兼容接口
- 不建议首版强绑定特定厂商 SDK
- 输出解析层建议统一处理流式文本、错误格式、重试逻辑

---

## 6. 部署形态建议

## 6.1 推荐形态

推荐采用：

`桌面客户端 + 本地 API 服务`

启动流程建议如下：

1. 用户启动桌面应用
2. 桌面应用检查本地服务是否已运行
3. 若未运行，则自动拉起本地服务
4. 前端通过本地 HTTP 或 IPC 与服务层通信
5. 本地服务完成数据读写与模型调用

---

## 6.2 为什么不建议首版做纯前端

纯前端虽然实现快，但会带来明显问题：

- 模型密钥管理不稳定
- 文件系统访问能力不足
- 工作流和任务队列难维护
- 后续扩展审核、版本管理、本地模型时会受限

因此首版就应该为本地服务层留出空间。

---

## 7. 模块划分建议

系统建议拆为以下核心模块：

## 7.1 项目模块

负责：

- 小说项目创建
- 项目列表
- 项目元数据管理

核心实体：

- `Novel`

---

## 7.2 设定模块

负责：

- 角色、世界观、地点、道具等设定维护
- 设定分类、标签、引用

核心实体：

- `SettingItem`
- `CharacterProfile`

---

## 7.3 大纲模块

负责：

- 总纲、卷纲、章纲管理
- 大纲树结构维护

核心实体：

- `OutlineNode`

---

## 7.4 章节计划模块

负责：

- 创建章节生成任务
- 管理章节目标
- 配置章节生成规则

核心实体：

- `ChapterPlan`
- `ChapterRuleSet`

---

## 7.5 正文草稿模块

负责：

- 保存章节草稿
- 记录草稿状态
- 保存历史版本

核心实体：

- `ChapterDraft`
- `DraftVersion`

---

## 7.6 审核模块

负责：

- 审核生成结果
- 输出问题清单
- 记录问题状态

核心实体：

- `ReviewReport`
- `ReviewIssue`

---

## 7.7 模型配置模块

负责：

- 保存模型提供方配置
- 测试连接
- 选择默认模型

核心实体：

- `ModelProvider`
- `ModelProfile`

---

## 7.8 工作流模块

负责：

- 任务编排
- 节点执行
- 执行日志
- 错误恢复

核心实体：

- `WorkflowExecution`
- `TaskExecution`

---

## 8. 数据模型建议

以下为建议的核心对象。

## 8.1 Novel

建议字段：

- `id`
- `title`
- `genre`
- `summary`
- `targetWordCount`
- `styleGuide`
- `forbiddenRules`
- `status`
- `createdAt`
- `updatedAt`

---

## 8.2 SettingItem

建议字段：

- `id`
- `novelId`
- `type`
- `name`
- `summary`
- `content`
- `tags`
- `version`
- `createdAt`
- `updatedAt`

---

## 8.3 OutlineNode

建议字段：

- `id`
- `novelId`
- `parentId`
- `level`
- `title`
- `summary`
- `goal`
- `orderIndex`
- `status`

其中 `level` 可取：

- `novel`
- `volume`
- `chapter`
- `scene`

---

## 8.4 ChapterPlan

建议字段：

- `id`
- `novelId`
- `outlineNodeId`
- `chapterNumber`
- `title`
- `summary`
- `targetWordCount`
- `minWordCount`
- `maxWordCount`
- `goal`
- `status`
- `ruleSetId`
- `reviewTemplateId`
- `createdAt`
- `updatedAt`

---

## 8.5 ChapterRuleSet

该对象用于表达“章节生成规则”，建议独立建模，而不是塞成一段文本。

建议字段：

- `id`
- `novelId`
- `chapterPlanId`
- `narrativePerspective`
- `toneStyle`
- `dialogueRatioPreference`
- `descriptionRatioPreference`
- `mustIncludePoints`
- `mustAvoidPoints`
- `continuityRequirements`
- `mustGenerateOutlineFirst`
- `mustGenerateByScenes`
- `minWordCount`
- `maxWordCount`
- `extraInstructions`

说明：

- `mustIncludePoints` 建议为数组
- `mustAvoidPoints` 建议为数组
- `continuityRequirements` 用于表达必须承接的信息
- 字数限制既可以保留在 `ChapterPlan`，也可以冗余进 `ChapterRuleSet`，方便执行时统一读取

---

## 8.6 ChapterDraft

建议字段：

- `id`
- `novelId`
- `chapterPlanId`
- `currentVersionId`
- `status`
- `lastGeneratedAt`
- `updatedAt`

---

## 8.7 DraftVersion

建议字段：

- `id`
- `draftId`
- `versionNumber`
- `content`
- `sourceType`
- `generationContext`
- `createdAt`

其中 `sourceType` 可区分：

- `generated`
- `review_revised`
- `manual_edit`

---

## 8.8 ReviewReport

建议字段：

- `id`
- `novelId`
- `chapterPlanId`
- `draftVersionId`
- `result`
- `score`
- `summary`
- `createdAt`

---

## 8.9 ReviewIssue

建议字段：

- `id`
- `reviewReportId`
- `type`
- `severity`
- `message`
- `suggestion`
- `relatedExcerpt`
- `ruleSource`

其中 `ruleSource` 用于标记问题来源，例如：

- 小说级规则
- 章节规则
- 系统一致性规则

---

## 9. 章节生成规则的技术实现建议

这是本产品的关键能力之一，建议将规则执行分为 3 个阶段。

## 9.1 规则收集阶段

系统从以下来源合并规则：

1. 小说级默认规则
2. 当前章节计划配置
3. 当前章节专属规则
4. 用户本次临时补充规则

输出一个统一的 `ResolvedChapterRuleSet`。

---

## 9.2 规则注入阶段

在调用模型前，将规则转换为结构化上下文。

建议注入内容包含：

- 本章目标
- 字数下限与上限
- 必须出现的情节点
- 禁止出现的内容
- 叙事视角
- 对话 / 描写倾向
- 前情承接要求

这一阶段要避免把规则拼成杂乱自然语言，建议采用稳定模板。

---

## 9.3 规则校验阶段

模型生成后，执行规则校验。

至少应校验：

- 字数是否落在限制区间
- 是否覆盖必须情节点
- 是否包含禁止内容
- 是否明显偏离叙事视角
- 是否违反连续性要求

首版可采用“规则校验 + LLM 审核”混合模式：

- 明确规则用程序判断
- 语义类规则用 LLM 审核

这样会比纯 LLM 判定更稳定。

---

## 10. 模型接入设计

## 10.1 Provider 抽象

建议抽象接口如下：

```ts
interface ModelProviderAdapter {
  testConnection(config: ProviderConfig): Promise<boolean>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  chat(input: ChatInput): Promise<ChatOutput>;
  streamChat(input: ChatInput): AsyncIterable<string>;
  structuredChat<T>(input: StructuredChatInput): Promise<T>;
}
```

---

## 10.2 ProviderConfig

建议至少包含：

- `baseUrl`
- `apiKey`
- `model`
- `headers`
- `timeoutMs`

后续可扩展：

- `organization`
- `proxy`
- `retryPolicy`

---

## 10.3 错误处理

模型接入层需要统一处理：

- 网络超时
- 认证失败
- 限流
- 非标准错误返回
- 流式中断

建议统一输出内部错误码，避免上层直接依赖各厂商原始错误格式。

---

## 11. 工作流执行设计

## 11.1 单章生成流程

建议流程：

1. 读取 `Novel`
2. 读取 `ChapterPlan`
3. 读取 `ChapterRuleSet`
4. 读取相关 `SettingItem`
5. 读取前文章节摘要
6. 拼装上下文
7. 如规则要求，先生成章纲
8. 生成正文
9. 执行审核
10. 保存草稿版本与审核结果

---

## 11.2 批量生成流程

批量生成不建议直接并发全部章节，而应采用“可控队列”。

建议能力：

- 队列执行
- 失败重试
- 单章节暂停
- 审核失败后停止后续任务

这样可以避免章节之间出现上下文断裂。

---

## 11.3 执行记录

每次工作流执行都建议保存：

- 输入参数
- 规则快照
- 选用模型
- Prompt 模板版本
- 输出结果
- 耗时
- 错误信息

这对于后续排查“为什么这一章写坏了”非常重要。

---

## 12. Prompt 与模板设计建议

首版不建议完全开放 prompt 编辑，而建议采用：

1. 系统内置模板
2. 局部可配置模板
3. 模板版本记录

建议至少维护以下模板类型：

- 大纲生成模板
- 章纲扩写模板
- 正文生成模板
- 审核模板
- 修订模板

模板应与规则系统配合，而不是彼此割裂。

---

## 13. 本地数据目录建议

建议为每个小说项目建立本地项目目录，例如：

```text
projects/
  novel-001/
    metadata.json
    settings/
    outlines/
    chapters/
    reviews/
    exports/
    snapshots/
```

说明：

- SQLite 负责主索引和关系查询
- 文件目录负责用户可见内容和导出产物
- 便于备份、迁移和手动恢复

---

## 14. 安全与隐私建议

由于产品是本地优先，安全重点主要在：

- API Key 安全保存
- 本地数据不被误删
- 导出与日志中避免泄露敏感信息

建议：

- API Key 使用系统安全存储或加密保存
- 重要项目支持自动快照
- 日志默认不记录完整敏感请求头

---

## 15. 可扩展性设计

为避免首版做死，建议在以下点上预留扩展能力：

## 15.1 多 Agent 扩展

后续可以拆成：

- 大纲 Agent
- 正文 Agent
- 审核 Agent
- 修订 Agent

当前阶段即使只提供统一 Agent，也建议内部按任务类型拆服务。

---

## 15.2 一致性系统扩展

后续可以增加：

- 时间线抽取
- 角色状态机
- 伏笔追踪
- 设定冲突检测

因此当前数据模型不要只保存全文文本，要保留结构化字段和中间结果。

---

## 15.3 本地模型扩展

后续如需支持本地模型，可在 Provider Adapter 层新增：

- 本地推理网关 Provider
- Ollama / LM Studio 风格 Provider
- 自定义兼容 API Provider

---

## 16. MVP 技术范围建议

为了控制首版复杂度，建议 MVP 仅覆盖以下技术能力：

- Tauri 客户端
- React 前端
- 本地 Node 服务
- SQLite 持久化
- OpenAI 兼容模型接入
- 小说项目 / 设定 / 大纲 / 章节计划 CRUD
- 单章生成工作流
- 基础审核工作流
- 章节规则配置与执行
- 草稿版本保存

暂缓：

- 多人协作
- 云同步
- 插件系统
- 本地模型深度适配
- 高级一致性引擎
- 自动化复杂统计分析

---

## 17. 建议的开发阶段

## 第一阶段：基础工作台

- 项目管理
- 设定管理
- 大纲管理
- 模型配置
- 本地存储

## 第二阶段：生成主链路

- 章节计划
- 章节规则配置
- 单章生成
- 草稿保存
- 流式输出

## 第三阶段：审核修订闭环

- 审核规则
- 审核结果页
- 修订建议
- 版本管理

## 第四阶段：扩展能力

- 批量生成
- 一致性增强
- 多模型路由
- 本地模型支持

---

## 18. 结论

该产品最适合采用“桌面工作台 + 本地服务 + OpenAI 兼容模型网关 + 工作流编排”的技术路线。

从工程角度看，最关键的不是把模型接进来，而是建立一套稳定的创作执行链路：

- 小说资产结构化存储
- 章节规则结构化配置
- 模型生成过程可控
- 审核结果可追踪
- 草稿版本可回溯

如果首版能把这条链路跑通，后续无论是增加更强的一致性系统，还是扩展多 Agent 和本地模型，都会更顺畅。
