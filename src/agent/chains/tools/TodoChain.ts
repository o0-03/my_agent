import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { TodoListData, HistoryMessage } from '../../../types';
import { contextService } from '../../../services/ContextService';

interface TodoChainInput {
  userInput: string;
  searchContent?: string;
  thinkingContent?: string;
  history?: HistoryMessage[];
}

export class TodoChain {
  constructor(private model: BaseChatModel) {}

  private buildTodoPrompt(input: TodoChainInput): string {
    const {
      userInput,
      searchContent = '',
      thinkingContent = '',
      history = [],
    } = input;

    const historyContext = contextService.buildHistoryContext(history, 3, true);

    let prompt = `你是一个专业的任务规划助手。请根据用户需求创建结构化的TODO列表。

用户当前需求：${userInput}
${historyContext}`;

    if (thinkingContent) {
      prompt += `

深度分析：
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
}

要求：
1. 生成3-8个具体、可执行的任务
2. 合理分配优先级（high/medium/low）
3. 预估时间要合理（1-480分钟）
4. 分类要明确
${history.length > 0 ? '5. 请基于对话历史优化任务列表，保持连贯性' : ''}
${thinkingContent ? '6. 请基于深度分析优化任务列表' : ''}
${searchContent ? '7. 请结合搜索信息创建更合理的任务' : ''}`;

    return prompt;
  }

  async invoke(input: TodoChainInput): Promise<TodoListData> {
    try {
      const prompt = this.buildTodoPrompt(input);

      const systemMessage = new SystemMessage(
        `你是一个专业的任务规划助手。${input.history && input.history.length > 0 ? '请基于对话历史提供连贯的任务规划。' : ''}`,
      );

      const response = await this.model.invoke([
        systemMessage,
        new HumanMessage(prompt),
      ]);

      const responseContent = response.content as string;

      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('未找到JSON响应，使用默认数据');
        return this.getDefaultTodoData();
      }

      const result = JSON.parse(jsonMatch[0]);
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

      return todoData;
    } catch (error) {
      console.error('TODO链执行失败:', error);
      return this.getDefaultTodoData();
    }
  }

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
        {
          id: '2',
          content: '制定具体实施步骤',
          priority: 'medium',
          estimated_time: 45,
          category: '执行',
          completed: false,
        },
        {
          id: '3',
          content: '评估和调整计划',
          priority: 'low',
          estimated_time: 20,
          category: '评估',
          completed: false,
        },
      ],
    };
  }
}
