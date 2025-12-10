import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { TodoListData, TodoItem } from '../../types';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// TODO链的输出类型
interface TodoChainOutput {
  type: 'todo_list';
  title: string;
  items: TodoItem[];
}

export class TodoChain {
  private model: BaseChatModel;

  constructor(fields: { model: BaseChatModel }) {
    this.model = fields.model;
  }

  async invoke(values: {
    userInput: string;
    thinkingContent?: string;
    searchContent?: string;
    useDeepThinking?: boolean;
    history?: Array<{ role: string; content: string }>;
  }): Promise<{
    todoData: TodoListData;
    content: string;
    finalThinking?: string;
  }> {
    const {
      userInput,
      thinkingContent = '',
      searchContent = '',
      useDeepThinking = false,
      history = [], //
    } = values;

    console.log('TodoChain调用，历史消息数:', history.length);

    let historyContext = '';
    if (history.length > 0) {
      historyContext = '\n\n**对话历史回顾：**\n';
      history.slice(-3).forEach((msg, index) => {
        const roleName = msg.role === 'user' ? '用户' : '助理';
        historyContext += `${index + 1}. ${roleName}: ${msg.content}\n`;
      });
    }

    let prompt = `你是一个专业的任务规划助手。请根据用户需求创建结构化的TODO列表。

用户当前需求：${userInput}`;

    if (historyContext) {
      prompt += historyContext;
    }

    if (thinkingContent) {
      prompt += `

助理的深度分析：
${thinkingContent}`;
    }

    if (searchContent) {
      prompt += `

相关搜索信息：
${searchContent}`;
    }

    prompt += `

请严格按照以下JSON格式返回，不要有任何额外的文本、解释或问候语：

{
  "type": "todo_list",
  "title": "简洁的标题，不超过10个字",
  "items": [
    {
      "id": "1",
      "content": "具体可执行的任务描述",
      "priority": "high/medium/low",
      "estimated_time": 数字（1-480之间）,
      "category": "任务分类"
    }
  ]
}`;

    const requirements = [
      '生成3-8个具体、可执行的任务',
      '合理分配优先级（high/medium/low）',
      '预估时间要合理（1-480分钟）',
      '分类要明确',
    ];

    if (history.length > 0) {
      requirements.push('请基于对话历史优化任务列表，保持连贯性');
    }

    if (thinkingContent) {
      requirements.push('请基于助理的分析优化任务列表');
    }

    if (searchContent) {
      requirements.push('请结合搜索信息创建更合理的任务');
    }

    prompt += `

要求：
${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}`;

    try {
      const systemMessage = new SystemMessage(
        `你是一个专业的任务规划助手。${history.length > 0 ? '请基于对话历史提供连贯的任务规划。' : ''}`,
      );

      let contextPrompt = '';
      if (history.length > 0) {
        const userHistory = history
          .filter(h => h.role === 'user')
          .map(h => h.content)
          .join(' ');
        contextPrompt = `\n用户之前提到过：${userHistory}`;
      }

      const finalPrompt = prompt + contextPrompt;
      const messages = [systemMessage, new HumanMessage(finalPrompt)];

      const response = await this.model.invoke(messages);
      const responseContent = response.content as string;

      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('未找到JSON响应，使用默认数据');
        return this.getDefaultTodoData(thinkingContent);
      }

      const result = JSON.parse(jsonMatch[0]);

      // 格式化TODO数据
      const todoData: TodoListData = {
        type: 'todo_list',
        title: result.title || '任务计划',
        items: result.items.map((item: any, index: number) => ({
          id: item.id || `todo_${Date.now()}_${index}`,
          content: item.content || `任务 ${index + 1}`,
          priority: ['high', 'medium', 'low'].includes(item.priority)
            ? (item.priority as 'high' | 'medium' | 'low')
            : 'medium',
          estimated_time:
            typeof item.estimated_time === 'number'
              ? Math.max(1, Math.min(item.estimated_time, 480))
              : 30,
          category: item.category || '默认',
          completed: false,
        })),
      };

      let content = `已为您生成任务计划："${todoData.title}"，包含 ${todoData.items.length} 个任务。`;
      if (history.length > 0) {
        content += '（已考虑您的对话历史）';
      }

      return {
        todoData,
        content,
        finalThinking: thinkingContent,
      };
    } catch (error) {
      console.error('❌ TODO链执行失败:', error);
      return this.getDefaultTodoData(thinkingContent);
    }
  }

  private getDefaultTodoData(thinkingContent?: string) {
    const defaultTodoData: TodoListData = {
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

    return {
      todoData: defaultTodoData,
      content: '已为您创建默认任务计划。',
      finalThinking: thinkingContent,
    };
  }

  async *stream(values: {
    userInput: string;
    history?: Array<{ role: string; content: string }>;
  }): AsyncGenerator<any> {
    const { userInput, history = [] } = values;

    console.log('🎯 开始流式生成TODO列表');
    console.log('历史消息数:', history.length);

    yield {
      type: 'content',
      content: '正在分析您的需求，规划任务中...',
    };

    try {
      const result = await this.invoke({
        userInput,
        history,
      });

      console.log('📋 TODO数据生成完成:', {
        title: result.todoData.title,
        itemsCount: result.todoData.items.length,
        hasHistory: history.length > 0,
      });

      let introMessage = `### 📋 ${result.todoData.title}\n\n已为您生成任务计划`;
      if (history.length > 0) {
        introMessage += '（已考虑您的对话历史）';
      }
      introMessage += `，包含 ${result.todoData.items.length} 个任务：\n`;

      yield {
        type: 'content',
        content: introMessage,
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
      console.error('流式生成TODO失败:', error);
      yield {
        type: 'content',
        content: '抱歉，生成任务计划时出现错误。',
      };
    }
  }
}
