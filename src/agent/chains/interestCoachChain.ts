import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import type { SearchResultItem, StreamChunk, TodoListData } from '../../types';
import { createGoalTool } from '../tools/goalTool';
import { createSearchTool } from '../tools/searchTool';
import { createTodoTool } from '../tools/todoTool';
import { TodoChain } from './todoChain';

interface Tool {
  name: string;
  description: string;
  invoke: (params: any) => Promise<any>;
}

interface SearchResult {
  success: boolean;
  content: string;
  results?: SearchResultItem[];
  sources?: string[];
}

interface ChainResult {
  response: string;
  toolUsed: string;
  data?: any;
  toolResult?: any;
}

export const SYSTEM_PROMPT = `你是一个专业的兴趣教练，专门帮助用户培养和发展兴趣爱好。
你的专长领域包括：健身、编程、阅读、烹饪、音乐、绘画、舞蹈等技能学习。

你可以使用 Markdown 格式来组织你的回答，使内容更加清晰易读。请合理使用以下格式：

1. **标题**：使用 #、##、### 来表示不同级别的标题
2. **列表**：使用 - 或 * 表示无序列表，使用 1. 2. 3. 表示有序列表
3. **强调**：使用 **粗体** 或 *斜体* 来强调重要内容
4. **代码**：使用 \`单行代码\` 或 \`\`\`多行代码块\`\`\`
5. **引用**：使用 > 来表示引用内容
6. **分割线**：使用 --- 或 *** 作为分割线

请注意：
- **段落之间使用一个空行分隔**，不要使用多个空行
- 列表项之间不要有空行（除非特别需要）
- 代码块前后各留一个空行即可
- 标题与内容之间留一个空行
- 避免不必要的换行和空格

你可以使用搜索工具获取最新的行业趋势、科学研究和实践方法。
请以专业教练的身份回答，提供最新、科学、实用的建议。
请确保你的回答既专业又易于阅读，合理使用 Markdown 格式进行排版。`;

export class InterestCoachChain {
  private model: BaseChatModel;
  private todoTool: Tool;
  private searchTool: Tool;
  private goalTool: Tool;
  private todoChain: TodoChain;

  constructor(fields: { model: BaseChatModel }) {
    this.model = fields.model;
    this.todoTool = createTodoTool(this.model);
    this.searchTool = createSearchTool();
    this.goalTool = createGoalTool(this.model);
    this.todoChain = new TodoChain({ model: this.model });
  }

  async invoke(values: {
    userInput: string;
    useWebSearch?: boolean;
    useDeepThinking?: boolean;
    history?: Array<{ role: string; content: string }>;
  }): Promise<ChainResult> {
    const {
      userInput,
      useWebSearch = false,
      useDeepThinking = false,
      history = [],
    } = values;

    console.log(`InterestCoachChain调用: ${userInput}`);
    console.log('深度思考模式:', useDeepThinking);
    console.log('联网搜索模式:', useWebSearch);
    console.log('历史消息数:', history.length);

    try {
      const selectedTool = await this.selectTool(userInput, useWebSearch);
      console.log('🛠️ 选择的工具:', selectedTool);

      if (!selectedTool || selectedTool === 'none') {
        let historyContext = '';
        if (history.length > 0) {
          historyContext = '\n\n**对话历史回顾：**\n';
          history.slice(-4).forEach((msg, index) => {
            const roleName = msg.role === 'user' ? '用户' : '助理';
            historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
          });
        }

        const prompt = ChatPromptTemplate.fromTemplate(`
作为兴趣教练，回答用户问题：

用户当前问题：{userInput}
${historyContext}

请基于对话历史提供连贯、专业的建议。`);

        const chain = RunnableSequence.from([
          prompt,
          this.model,
          new StringOutputParser(),
        ]);

        const response = await chain.invoke({ userInput });

        return {
          response,
          toolUsed: 'none',
        };
      }

      const toolResult = await this.executeToolWithEnhancements(
        selectedTool,
        userInput,
        useWebSearch,
        useDeepThinking,
      );

      let historyContext = '';
      if (history.length > 0) {
        historyContext = '\n\n**对话上下文：**\n';
        history.slice(-3).forEach((msg, index) => {
          const roleName = msg.role === 'user' ? '用户' : '助理';
          historyContext += `${roleName}: ${msg.content}\n`;
        });
      }

      const prompt = ChatPromptTemplate.fromTemplate(`
基于工具执行结果回答用户问题：

用户当前问题：{userInput}
${historyContext}

工具类型：{toolType}
工具结果：
{toolResult}

请整合对话历史和工具结果，提供连贯、完整的回答。`);

      const chain = RunnableSequence.from([
        prompt,
        this.model,
        new StringOutputParser(),
      ]);

      const response = await chain.invoke({
        userInput,
        toolType: selectedTool,
        toolResult:
          typeof toolResult.response === 'string'
            ? toolResult.response
            : JSON.stringify(toolResult.response),
      });

      return {
        response,
        toolUsed: selectedTool,
        data: toolResult.data,
        toolResult: toolResult.response,
      };
    } catch (error) {
      console.error('InterestCoachChain执行失败:', error);
      return {
        response: '抱歉，处理您的请求时出现错误。',
        toolUsed: 'none',
      };
    }
  }

  private async selectTool(
    userInput: string,
    useWebSearch: boolean,
  ): Promise<string | null> {
    const toolDescriptions = `
可用工具：
1. create_todo_list - 创建任务列表（TODO List），适用于需要规划、安排、待办事项的场景
2. web_search - 搜索最新信息，适用于需要最新数据、新闻、趋势的场景
3. create_learning_goal - 制定学习目标，适用于需要目标设定、学习计划的场景`;

    const prompt = ChatPromptTemplate.fromTemplate(`
分析用户问题并选择合适的工具：

用户问题：{userInput}
搜索功能启用：{useWebSearch}

${toolDescriptions}

选择规则：
1. 如果需要规划、计划、待办事项 → create_todo_list
2. 如果需要最新信息、新闻、趋势，且搜索功能启用 → web_search
3. 如果需要制定目标、学习计划 → create_learning_goal
4. 其他情况 → none

只返回工具名称或"none"，不要有其他内容。`);

    const chain = RunnableSequence.from([
      prompt,
      this.model,
      new StringOutputParser(),
    ]);

    const toolName = await chain.invoke({
      userInput,
      useWebSearch: useWebSearch ? '是' : '否',
    });

    const trimmedName = toolName.trim().toLowerCase();

    if (
      ['create_todo_list', 'web_search', 'create_learning_goal'].includes(
        trimmedName,
      )
    ) {
      return trimmedName;
    }

    return null;
  }

  private async executeToolWithEnhancements(
    toolName: string,
    userInput: string,
    useWebSearch: boolean,
    useDeepThinking: boolean,
    history: Array<{ role: string; content: string }> = [],
  ): Promise<{ response: any; data?: any }> {
    let searchContent = '';
    let thinkingContent = '';
    let searchResults: SearchResultItem[] = [];

    if (useWebSearch) {
      const searchQuery = this.getToolSearchQuery(toolName, userInput, history);
      try {
        const searchResult = await this.searchTool.invoke({
          query: searchQuery,
          maxResults: 3,
        });
        const searchData = JSON.parse(searchResult) as SearchResult;
        if (searchData.success) {
          searchContent = searchData.content;
          searchResults = searchData.results || [];
          console.log(`搜索完成，找到 ${searchResults.length} 条信息`);
        }
      } catch (error) {
        console.error('搜索失败:', error);
      }
    }

    if (useDeepThinking) {
      thinkingContent = await this.generateThinkingContent(
        toolName,
        userInput,
        searchContent,
        history,
      );
      console.log('深度思考内容长度:', thinkingContent.length);
    }

    switch (toolName) {
      case 'create_todo_list':
        return await this.executeTodoTool(
          userInput,
          searchContent,
          thinkingContent,
          history,
        );

      case 'web_search':
        return await this.executeSearchTool(
          userInput,
          searchContent,
          thinkingContent,
          history,
        );

      case 'create_learning_goal':
        return await this.executeGoalTool(
          userInput,
          searchContent,
          thinkingContent,
          history,
        );

      default:
        throw new Error(`未知工具: ${toolName}`);
    }
  }

  private getToolSearchQuery(
    toolName: string,
    userInput: string,
    history: Array<{ role: string; content: string }>,
  ): string {
    let baseQuery = '';

    switch (toolName) {
      case 'create_todo_list':
        baseQuery = `${userInput} 任务规划 最佳实践 时间管理`;
        break;
      case 'create_learning_goal': {
        const { interest, level } = this.extractInterestAndLevelFromInput(
          userInput,
          history,
        );
        baseQuery = `${interest}学习目标 ${level}水平 最新方法`;
        break;
      }
      case 'web_search':
        baseQuery = userInput;
        break;
      default:
        baseQuery = userInput;
    }

    if (history.length > 0) {
      const lastUserMessages = history
        .filter(h => h.role === 'user')
        .slice(-2)
        .map(h => h.content);
      if (lastUserMessages.length > 0) {
        const historyKeywords = lastUserMessages.join(' ');
        return `${baseQuery} ${historyKeywords}`;
      }
    }

    return baseQuery;
  }

  private async generateThinkingContent(
    toolName: string,
    userInput: string,
    searchContent: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<string> {
    let historyContext = '';
    if (history.length > 0) {
      historyContext = '\n\n**对话历史：**\n';
      history.slice(-3).forEach((msg, index) => {
        const roleName = msg.role === 'user' ? '用户' : '助理';
        historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
      });
    }

    const toolPrompts: Record<string, string> = {
      create_todo_list: `你是一个专业的任务规划专家。请分析用户需求，深度思考如何制定合理的任务计划。

用户当前需求：${userInput}
${historyContext}
${searchContent ? `\n相关搜索信息：${searchContent}` : ''}

请从以下几个方面进行深度分析：
1. 基于对话历史，需求的核心目标是什么？
2. 需要哪些关键步骤？
3. 可能的难点和挑战是什么？
4. 如何合理分配时间和优先级？
5. 最佳实践和建议是什么？`,

      create_learning_goal: `你是一个专业的兴趣教练。请分析用户需求，深度思考如何制定有效的学习目标。

用户当前需求：${userInput}
${historyContext}
${searchContent ? `\n相关搜索信息：${searchContent}` : ''}

请从以下几个方面进行深度分析：
1. 基于对话历史，用户的学习动机是什么？
2. 当前水平和目标水平之间的差距？
3. 学习路径应该如何设计？
4. 如何保持学习动力？
5. 评估学习成果的方法？`,

      web_search: `你是一个专业的信息分析师。请分析搜索结果，深度思考如何回答用户问题。

用户当前问题：${userInput}
${historyContext}
${searchContent ? `\n搜索到的信息：${searchContent}` : ''}

请从以下几个方面进行深度分析：
1. 基于对话历史，用户真正关心的是什么？
2. 搜索信息的可靠性和相关性？
3. 如何整合不同来源的信息？
4. 信息的时效性和实用性？
5. 如何用最清晰的方式呈现信息？`,
    };

    const prompt =
      toolPrompts[toolName] ||
      `请基于以下信息深度分析：\n用户问题：${userInput}\n${historyContext}`;

    const response = await this.model.invoke([
      new SystemMessage(
        '你是一个专业的分析师，请基于对话历史展示你的思考过程。',
      ),
      new HumanMessage(prompt),
    ]);

    return response.content as string;
  }

  private extractInterestAndLevelFromInput(
    userInput: string,
    history: Array<{ role: string; content: string }>,
  ): { interest: string; level: string } {
    const allText = [...history.map(h => h.content), userInput].join(' ');

    const interests = ['健身', '编程', '音乐', '绘画', '舞蹈', '烹饪', '阅读'];
    const levels = ['beginner', 'intermediate', 'advanced'];
    const levelKeywords = {
      beginner: ['新手', '初学者', '小白', '刚入门'],
      intermediate: ['中级', '有一定基础', '学过一些'],
      advanced: ['高级', '精通', '专家', '熟练'],
    };

    // 从合并文本中查找兴趣
    let foundInterest = '通用技能';
    for (const interest of interests) {
      if (allText.includes(interest)) {
        foundInterest = interest;
        break;
      }
    }

    // 从合并文本中查找水平
    let foundLevel = 'beginner';
    for (const [level, keywords] of Object.entries(levelKeywords)) {
      if (
        keywords.some(keyword => allText.includes(keyword)) ||
        allText.includes(level)
      ) {
        foundLevel = level;
        break;
      }
    }

    return { interest: foundInterest, level: foundLevel };
  }

  private async executeTodoTool(
    userInput: string,
    searchContent: string,
    thinkingContent: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ response: any; data?: any }> {
    try {
      const result = await this.todoChain.invoke({
        userInput,
        searchContent,
        thinkingContent,
        useDeepThinking: !!thinkingContent,
        history,
      });

      return {
        response: result.content,
        data: result.todoData,
      };
    } catch (error) {
      console.error('TODO处理失败:', error);
      return {
        response: '创建任务列表时出现错误。',
        data: this.getDefaultTodoData(),
      };
    }
  }

  private async executeSearchTool(
    userInput: string,
    searchContent: string,
    thinkingContent: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ response: any; data?: any }> {
    if (!searchContent) {
      return {
        response: '搜索功能未启用或搜索失败。',
      };
    }
    let historyContext = '';
    if (history.length > 0) {
      historyContext = '\n\n**对话历史：**\n';
      history.slice(-3).forEach((msg, index) => {
        const roleName = msg.role === 'user' ? '用户' : '助理';
        historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
      });
    }

    const prompt = ChatPromptTemplate.fromTemplate(`
基于以下信息回答用户问题：

用户当前问题：{userInput}
${historyContext}

搜索到的信息：
{searchContent}

${thinkingContent ? '深度思考分析：\n{thinkingContent}' : ''}

请基于对话历史提供最新、科学的建议：`);

    const chain = RunnableSequence.from([
      prompt,
      this.model,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      userInput,
      searchContent,
      thinkingContent,
    });

    return {
      response,
      data: { searchContent, thinkingContent },
    };
  }

  private async executeGoalTool(
    userInput: string,
    searchContent: string,
    thinkingContent: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ response: any; data?: any }> {
    try {
      const { interest, level } = this.extractInterestAndLevelFromInput(
        userInput,
        history,
      );

      let historyContext = '';
      if (history.length > 0) {
        historyContext = '\n\n**对话历史回顾：**\n';
        history.slice(-3).forEach((msg, index) => {
          const roleName = msg.role === 'user' ? '用户' : '助理';
          historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
        });
      }

      // 构建增强的提示词
      let prompt = `作为专业兴趣教练，为用户制定个性化的学习目标。

用户信息：
- 兴趣领域：${interest}
- 当前水平：${level}
- 具体需求：${userInput}`;

      if (historyContext) {
        prompt += `\n\n对话历史：${historyContext}`;
      }

      if (searchContent) {
        prompt += `

相关搜索信息：
${searchContent}

请基于以上最新信息，制定更科学、更有效的学习目标。`;
      }

      if (thinkingContent) {
        prompt += `

深度思考分析：
${thinkingContent}`;
      }

      prompt += `

请生成具体、可衡量、可实现、相关、有时限的(SMART)目标。`;

      const response = await this.goalTool.invoke({
        interest,
        level,
        timeframe: '一个月',
        specificNeeds: prompt, // 将增强的提示词传入
      });

      return {
        response,
        data: { interest, level, searchContent, thinkingContent },
      };
    } catch (error) {
      console.error('目标制定失败:', error);
      return {
        response: '制定学习目标时出现错误。',
        data: null,
      };
    }
  }

  // 🔧 获取默认TODO数据
  private getDefaultTodoData(): TodoListData {
    return {
      type: 'todo_list',
      title: '任务计划',
      items: [
        {
          id: '1',
          content: '分析需求并明确目标',
          priority: 'high',
          estimated_time: 30,
          category: '规划',
          completed: false,
        },
      ],
    };
  }

  // 流式调用方法
  async *stream(values: {
    userInput: string;
    useWebSearch?: boolean;
    useDeepThinking?: boolean;
    history?: Array<{ role: string; content: string }>;
  }): AsyncGenerator<StreamChunk, void, unknown> {
    const {
      userInput,
      useWebSearch = false,
      useDeepThinking = false,
      history = [],
    } = values;

    console.log('开始流式处理');
    console.log('深度思考模式:', useDeepThinking);
    console.log('联网搜索模式:', useWebSearch);
    console.log('历史消息数:', history.length);

    try {
      const selectedTool = await this.selectTool(userInput, useWebSearch);
      console.log('选择的工具:', selectedTool);

      if (!selectedTool || selectedTool === 'none') {
        console.log('直接回答问题，使用流式接口');
        yield* this.streamGeneralResponse(
          userInput,
          useWebSearch,
          useDeepThinking,
          history,
        );
        return;
      }

      switch (selectedTool) {
        case 'create_todo_list':
          yield* this.streamTodoTool(
            userInput,
            useWebSearch,
            useDeepThinking,
            history,
          );
          break;

        case 'web_search':
          yield* this.streamSearchTool(
            userInput,
            useWebSearch,
            useDeepThinking,
            history,
          );
          break;

        case 'create_learning_goal':
          yield* this.streamGoalTool(
            userInput,
            useWebSearch,
            useDeepThinking,
            history,
          );
          break;
      }
    } catch (error) {
      console.error('流式处理失败:', error);
      yield {
        type: 'content',
        content: '抱歉，处理您的请求时出现错误。',
      };
    }
  }

  // 通用流式响应
  private async *streamGeneralResponse(
    userInput: string,
    useWebSearch: boolean,
    useDeepThinking: boolean,
    history: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    let searchContent = '';
    let searchResults: SearchResultItem[] = [];

    if (useWebSearch) {
      try {
        yield {
          type: 'search',
          content: '正在搜索相关信息...',
        };

        let searchQuery = userInput;
        if (history.length > 0) {
          const lastUserMsg = history.filter(h => h.role === 'user').pop();
          if (lastUserMsg) {
            searchQuery = `${lastUserMsg.content} ${userInput}`;
          }
        }

        const searchResult = await this.searchTool.invoke({
          query: `${searchQuery} 最新方法 最佳实践`,
          maxResults: 3,
        });

        const parsed = JSON.parse(searchResult) as SearchResult;
        if (parsed.success) {
          searchContent = parsed.content;
          searchResults = parsed.results || [];

          yield {
            type: 'search',
            content: '搜索完成，找到相关信息',
            searchResults: searchResults,
          };
        }
      } catch (error) {
        console.error('补充搜索失败:', error);
        yield {
          type: 'thinking',
          content: '搜索失败，将基于对话历史和现有知识回答。',
        };
      }
    }

    let historyContext = '';
    if (history.length > 0) {
      console.log('包含对话历史，增强上下文理解');
      historyContext = '\n\n**对话历史回顾：**\n';
      history.slice(-4).forEach((msg, index) => {
        const roleName = msg.role === 'user' ? '用户' : '助理';
        historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
      });
    }

    const systemMessage = new SystemMessage(
      `你是一个专业的兴趣教练。${history.length > 0 ? '请基于对话历史提供连贯、一致的回答。' : ''}`,
    );

    // 将历史消息转换为 LangChain 消息格式
    const historyMessages = history.map(msg =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    const currentPrompt = `基于以下信息回答用户问题：

用户当前问题：${userInput}
${historyContext}
${searchContent ? `\n**相关搜索信息：**\n${searchContent}` : ''}

请提供专业、实用的建议：`;

    const currentMessage = new HumanMessage(currentPrompt);

    const allMessages = [systemMessage, ...historyMessages, currentMessage];

    console.log('准备调用模型，总消息数:', allMessages.length);
    console.log('历史消息数:', historyMessages.length);
    console.log('当前问题:', userInput.substring(0, 50));

    yield* this.streamModelResponse(allMessages, useDeepThinking);
  }

  private async *streamTodoTool(
    userInput: string,
    useWebSearch: boolean,
    useDeepThinking: boolean,
    history: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    console.log('开始处理TODO列表任务');
    console.log('历史消息数:', history.length);

    let searchContent = '';
    let searchResults: SearchResultItem[] = [];
    let thinkingContent = '';

    // 搜索阶段
    if (useWebSearch) {
      yield {
        type: 'search',
        content: '正在搜索相关学习资源和方法...',
      };

      try {
        let searchQuery = userInput;
        if (history.length > 0) {
          const relevantHistory = history
            .filter(h => h.role === 'user')
            .map(h => h.content)
            .join(' ');
          searchQuery = `${relevantHistory} ${userInput}`;
        }

        const result = await this.searchTool.invoke({
          query: `${searchQuery} 学习方法 最佳实践 任务规划`,
          maxResults: 5,
        });

        const searchData = JSON.parse(result) as SearchResult;
        if (searchData.success) {
          searchResults = searchData.results || [];
          searchContent = searchData.content || '';

          yield {
            type: 'search',
            content: `搜索完成，找到 ${searchResults.length} 条相关信息`,
            searchResults: searchResults,
          };
        }
      } catch (error) {
        console.error('ODO搜索失败:', error);
        yield {
          type: 'thinking',
          content: '搜索失败，将基于对话历史和现有知识创建任务列表。',
        };
      }
    }

    // 深度思考阶段
    if (useDeepThinking) {
      yield {
        type: 'thinking',
        content: '正在深度分析需求，规划任务中...',
      };

      let historyContext = '';
      if (history.length > 0) {
        historyContext = '\n\n**对话历史：**\n';
        history.slice(-3).forEach((msg, index) => {
          const roleName = msg.role === 'user' ? '用户' : '助理';
          historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
        });
      }

      const thinkingPrompt = `你是一个专业的任务规划专家。请分析用户需求，深度思考如何制定合理的任务计划。

用户当前需求：${userInput}
${historyContext}
${searchContent ? `\n相关搜索信息：${searchContent}` : ''}

请基于对话历史详细分析，生成完整的思考过程：`;

      const thinkingMessages = [
        new SystemMessage(
          '你是一个专业的任务规划专家，请基于对话历史展示你的思考过程。',
        ),
        new HumanMessage(thinkingPrompt),
      ];

      let thinkingChunks = '';
      for await (const chunk of this.streamModelResponse(
        thinkingMessages,
        true,
      )) {
        if (chunk.type === 'thinking') {
          thinkingChunks += chunk.content || '';
          yield chunk;
        } else if (chunk.type === 'content') {
          thinkingChunks += chunk.content || '';
          yield {
            type: 'thinking',
            content: chunk.content,
          };
        }
      }

      thinkingContent = thinkingChunks;
    } else {
      yield {
        type: 'thinking',
        content: '正在分析需求，规划任务中...',
      };
    }

    // 生成TODO列表
    try {
      const result = await this.todoChain.invoke({
        userInput,
        thinkingContent: thinkingContent,
        searchContent: searchContent,
        useDeepThinking: useDeepThinking,
        history,
      });

      yield {
        type: 'thinking',
        content: '任务列表已生成，正在格式化...',
      };

      yield {
        type: 'content',
        content: `### ${result.todoData.title}\n\n基于${useDeepThinking ? '深度分析' : '分析'}${useWebSearch ? '和最新信息' : ''}，已为您生成任务计划，包含 ${result.todoData.items.length} 个任务：\n`,
      };

      yield {
        type: 'tododata',
        content: '',
        todoData: result.todoData,
      };

      const taskPreview = result.todoData.items
        .slice(0, 3)
        .map(
          (item, index) =>
            `${index + 1}. ${item.content} (${item.priority}优先级, ${item.estimated_time}分钟)`,
        )
        .join('\n');

      yield {
        type: 'content',
        content: `\n**任务列表：**\n${taskPreview}\n\n💡 提示：您可以勾选完成任务，或删除不需要的任务。`,
      };
    } catch (error) {
      console.error('❌ 生成任务列表失败:', error);
      yield {
        type: 'content',
        content: '创建任务列表时出现错误，将使用基础方案。',
      };

      const fallbackResult = await this.todoChain.invoke({
        userInput,
        history,
      });
      yield {
        type: 'tododata',
        content: '',
        todoData: fallbackResult.todoData,
      };
    }
  }

  private async *streamSearchTool(
    userInput: string,
    useWebSearch: boolean,
    useDeepThinking: boolean,
    history: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!useWebSearch) {
      yield {
        type: 'content',
        content: '搜索功能未启用，请启用后重试。',
      };
      return;
    }

    yield {
      type: 'search',
      content: '正在搜索最新信息...',
    };

    try {
      let searchQuery = userInput;
      if (history.length > 0) {
        const relevantHistory = history
          .filter(h => h.role === 'user')
          .map(h => h.content)
          .join(' ');
        searchQuery = `${relevantHistory} ${userInput}`;
      }

      const result = await this.searchTool.invoke({
        query: searchQuery,
        maxResults: 5,
      });

      const searchData = JSON.parse(result) as SearchResult;

      if (searchData.success) {
        yield {
          type: 'search',
          content: `✅ 搜索完成，找到 ${searchData.results?.length || 0} 条相关信息`,
          searchResults: searchData.results,
        };

        let historyContext = '';
        if (history.length > 0) {
          historyContext = '\n\n**对话历史：**\n';
          history.slice(-3).forEach((msg, index) => {
            const roleName = msg.role === 'user' ? '用户' : '助理';
            historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
          });
        }

        const prompt = `基于以下信息回答用户问题：

用户当前问题：${userInput}
${historyContext}

搜索到的信息：
${searchData.content}

请基于对话历史提供最新、科学的建议：`;

        const messages = [
          new SystemMessage('你是一个专业的兴趣教练，请基于对话历史提供回答。'),
          new HumanMessage(prompt),
        ];

        yield* this.streamModelResponse(messages, useDeepThinking);
      } else {
        yield {
          type: 'content',
          content: '搜索失败，将基于对话历史和现有知识回答。',
        };
      }
    } catch (error) {
      console.error('❌ 搜索工具流式处理失败:', error);
      yield {
        type: 'content',
        content: '搜索功能暂时不可用。',
      };
    }
  }

  private async *streamGoalTool(
    userInput: string,
    useWebSearch: boolean,
    useDeepThinking: boolean,
    history: Array<{ role: string; content: string }> = [],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    console.log('开始制定学习目标');
    console.log('历史消息数:', history.length);

    let searchContent = '';
    let searchResults: SearchResultItem[] = [];

    if (useWebSearch) {
      yield {
        type: 'search',
        content: '正在搜索相关学习资源和目标制定方法...',
      };

      try {
        const { interest, level } = this.extractInterestAndLevelFromInput(
          userInput,
          history,
        );

        let searchQuery = `${interest}学习目标 ${level}水平 最新方法 最佳实践`;
        if (history.length > 0) {
          const relevantHistory = history
            .filter(h => h.role === 'user')
            .map(h => h.content)
            .join(' ');
          searchQuery = `${searchQuery} ${relevantHistory}`;
        }

        const result = await this.searchTool.invoke({
          query: searchQuery,
          maxResults: 5,
        });

        const searchData = JSON.parse(result) as SearchResult;

        if (searchData.success) {
          searchResults = searchData.results || [];
          searchContent = searchData.content || '';

          yield {
            type: 'search',
            content: `搜索完成，找到 ${searchResults.length} 条相关信息`,
            searchResults: searchResults,
          };
        }
      } catch (error) {
        console.error('目标搜索失败:', error);
        yield {
          type: 'thinking',
          content: '搜索失败，将基于对话历史和现有知识制定学习目标。',
        };
      }
    }

    if (useDeepThinking) {
      yield {
        type: 'thinking',
        content: '正在深度分析需求，制定个性化的学习目标...',
      };
    }

    try {
      const { interest, level } = this.extractInterestAndLevelFromInput(
        userInput,
        history,
      );

      let historyContext = '';
      if (history.length > 0) {
        historyContext = '\n\n**对话历史回顾：**\n';
        history.slice(-3).forEach((msg, index) => {
          const roleName = msg.role === 'user' ? '用户' : '助理';
          historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
        });
      }

      let prompt = `作为专业兴趣教练，为用户制定个性化的学习目标。

用户信息：
- 兴趣领域：${interest}
- 当前水平：${level}
- 具体需求：${userInput}`;

      if (historyContext) {
        prompt += `\n\n对话历史：${historyContext}`;
      }

      if (searchContent) {
        prompt += `

相关搜索信息：
${searchContent}

请基于以上最新信息和对话历史，制定更科学、更有效的学习目标。`;
      }

      prompt += `

请生成具体、可衡量、可实现、相关、有时限的(SMART)目标。
使用Markdown格式组织你的回答，包括：
1. **总体目标** - 简洁的总体描述
2. **具体目标** - 3-5个具体可衡量的目标
3. **时间安排** - 一个月的时间规划
4. **评估标准** - 如何评估进度和成功
5. **资源建议** - 推荐的学习资源`;

      const messages = [
        new SystemMessage('你是一个专业的兴趣教练，擅长制定学习计划和目标'),
        new HumanMessage(prompt),
      ];

      yield* this.streamModelResponse(messages, useDeepThinking);
    } catch (error) {
      console.error('目标工具流式处理失败:', error);
      yield {
        type: 'content',
        content: '制定学习目标时出现错误。',
      };
    }
  }

  private async *streamModelResponse(
    messages: Array<SystemMessage | HumanMessage | AIMessage>,
    useDeepThinking: boolean,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    console.log('调用模型流式接口，消息数量:', messages.length);
    console.log('深度思考模式:', useDeepThinking);

    try {
      if (this.model && typeof (this.model as any).streamRaw === 'function') {
        const streamOptions = {
          stream: true,
          useDeepThinking: useDeepThinking,
        };

        console.log('使用 streamRaw 接口');
        const streamGenerator = (this.model as any).streamRaw(
          messages,
          streamOptions,
        );

        let chunkCount = 0;
        for await (const chunk of streamGenerator) {
          chunkCount++;

          if (chunk.type === 'content' && chunk.content) {
            yield {
              type: 'content',
              content: chunk.content,
            };
          } else if (chunk.type === 'thinking' && chunk.content) {
            if (useDeepThinking && chunk.content.trim().length > 0) {
              yield {
                type: 'thinking',
                content: chunk.content,
              };
            }
          }
        }

        console.log(`模型流式响应完成，共 ${chunkCount} 个chunks`);
      } else {
        console.warn('模型不支持流式接口，回退到非流式');
        const response = await this.model.invoke(messages);
        yield {
          type: 'content',
          content: response.content as string,
        };
      }
    } catch (error) {
      console.error('模型流式响应失败:', error);
      yield {
        type: 'content',
        content: '抱歉，生成回答时出现错误。',
      };
    }
  }
}
