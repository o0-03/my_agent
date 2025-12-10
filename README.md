# 项目概述

基于 Modern.js 全栈框架构建的智能对话助手系统，整合了火山引擎大模型、LangChain 工具链和 MongoDB 数据库，实现了支持深度思考、联网搜索和任务规划的 AI 对话应用。

# 技术架构

前端框架: Modern.js + React + TypeScript + Ant Design

后端架构: Modern.js BFF + Lambda 函数 + SSE 流式传输

AI 层: LangChain 代理 + 火山引擎 Doubao 模型 + 工具链

数据层: MongoDB

# 核心技术实现

## 智能工具链系统

LangChain 代理架构: 实现基于用户意图的自动工具选择机制

多工具集成:

web_search: 基于 Tavily API 的实时信息检索

create_todo_list: 结构化任务规划与生成

create_learning_goal: 个性化学习目标制定

深度思考模式: 通过模型原生 thinking 能力展示 AI 推理过程

## 实时流式传输系统

SSE 优化: 实现稳定的长连接数据传输

分块处理机制: 实时解析模型返回的 thinking/content 数据流

打字机效果: 前端动态渲染实现逐字输出体验

断线重连: 自动恢复机制保证对话连续性

## 存储持久化方案

MongoDB 存储：完整对话历史存储

对话管理：支持创建、切换、归档、删除对话

## 前端可视化组件

交互式 TodoList: 支持任务增删改查、优先级排序、进度追踪

搜索结果可视化: 卡片式布局、相关性评分、批量操作

Markdown 实时渲染: 支持代码块、列表、表格等丰富格式

响应式侧边栏: 对话历史管理，支持归档、搜索、批量操作

# 项目树

```
my_agent
├─ .browserslistrc
├─ .env
├─ .hintrc
├─ .npmrc
├─ .nvmrc
├─ api
│  └─ lambda
│     ├─ conversations.ts
│     └─ stream.ts
├─ biome.json
├─ modern.config.ts
├─ package.json
├─ pnpm-lock.yaml
├─ README.md
├─ src
│  ├─ agent
│  │  ├─ chains
│  │  │  ├─ interestCoachChain.ts
│  │  │  └─ todoChain.ts
│  │  ├─ doubao_langchain.ts
│  │  ├─ index.ts
│  │  ├─ interestCoach.ts
│  │  └─ tools
│  │     ├─ goalTool.ts
│  │     ├─ searchTool.ts
│  │     └─ todoTool.ts
│  ├─ components
│  │  ├─ ChatHeader.module.css
│  │  ├─ ChatHeader.tsx
│  │  ├─ ChatInput.module.css
│  │  ├─ ChatInput.tsx
│  │  ├─ ConversationSidebar.module.css
│  │  ├─ ConversationSidebar.tsx
│  │  ├─ MessageItem.module.css
│  │  ├─ MessageItem.tsx
│  │  ├─ MessageList.module.css
│  │  ├─ MessageList.tsx
│  │  ├─ SearchResultsVisual.tsx
│  │  └─ TodoList.tsx
│  ├─ config
│  │  └─ index.ts
│  ├─ lib
│  │  └─ mongodb.ts
│  ├─ models
│  │  └─ Conversation.ts
│  ├─ modern-app-env.d.ts
│  ├─ modern.runtime.ts
│  ├─ routes
│  │  ├─ index.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ services
│  │  └─ conversationService.ts
│  └─ types
│     └─ index.ts
└─ tsconfig.json

```
