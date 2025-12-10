import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { TodoListData, TodoItem } from '../../types';
import { HumanMessage, SystemMessage } from 'langchain';

// 定义TODO数据的Zod模式
const TodoItemSchema = z.object({
  id: z.string().describe('任务ID'),
  content: z.string().describe('任务描述'),
  priority: z.enum(['high', 'medium', 'low']).describe('优先级'),
  estimated_time: z.number().min(1).max(480).describe('预计时间（分钟）'),
  category: z.string().describe('分类'),
  completed: z.boolean().default(false).describe('是否完成'),
});

const TodoListSchema = z.object({
  type: z.literal('todo_list'),
  title: z.string().describe('列表标题'),
  items: z.array(TodoItemSchema).min(1).max(10).describe('任务列表'),
});

// 创建TODO列表工具
export const createTodoTool = (model: BaseChatModel) => {
  return new DynamicStructuredTool({
    name: 'create_todo_list',
    description: '为用户创建任务列表（TODO List）',
    schema: z.object({
      userInput: z.string().describe('用户的需求描述'),
      useDeepThinking: z.boolean().optional().describe('是否启用深度思考'),
    }),
    func: async ({ userInput, useDeepThinking = false }) => {
      try {
        console.log('🎯 开始创建TODO列表，输入:', userInput);

        const { RunnableSequence } = await import('@langchain/core/runnables');

        const todoPrompt = `你是一个专业的任务规划助手。请根据用户需求创建结构化的TODO列表。

用户需求：${userInput}

请分析需求并生成一个合理的任务列表，包含以下信息：
1. 标题：简洁明了地概括任务主题
2. 任务项：3-8个具体、可执行的任务
3. 每个任务包含：内容、优先级、预计时间、分类

重要：只返回有效的JSON格式，不要有任何额外的文本。`;

        // 创建序列链
        const todoChain = RunnableSequence.from([
          async () => ({
            system: todoPrompt,
          }),
          async input => {
            const response = await model.invoke([
              new SystemMessage('你是一个专业的任务规划助手。'),
              new HumanMessage(input.system),
            ]);
            return { content: response.content };
          },
          async input => {
            try {
              const jsonMatch = input.content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed;
              }
              throw new Error('未找到有效的JSON');
            } catch (error) {
              console.error('JSON解析失败，使用默认格式:', error);
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
                  },
                  {
                    id: '2',
                    content: '制定具体实施步骤',
                    priority: 'medium',
                    estimated_time: 45,
                    category: '执行',
                  },
                  {
                    id: '3',
                    content: '评估和调整计划',
                    priority: 'low',
                    estimated_time: 20,
                    category: '评估',
                  },
                ],
              };
            }
          },
        ]);

        const result = await todoChain.invoke({});

        const validatedResult = TodoListSchema.parse(result);

        const todoData: TodoListData = {
          type: 'todo_list',
          title: validatedResult.title,
          items: validatedResult.items.map(item => ({
            ...item,
            completed: item.completed || false,
          })),
        };

        console.log('TODO列表创建成功:', {
          title: todoData.title,
          itemsCount: todoData.items.length,
          firstItem: todoData.items[0],
        });

        return JSON.stringify(todoData);
      } catch (error) {
        console.error('创建TODO列表失败:', error);
        const defaultData: TodoListData = {
          type: 'todo_list',
          title: '任务计划',
          items: [
            {
              id: '1',
              content: '分析用户需求',
              priority: 'high',
              estimated_time: 30,
              category: '分析',
              completed: false,
            },
          ],
        };
        return JSON.stringify(defaultData);
      }
    },
  });
};
