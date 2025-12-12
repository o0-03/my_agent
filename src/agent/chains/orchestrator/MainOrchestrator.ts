import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { HistoryMessage, StreamChunk, TodoListData } from '../../../types';
import { SearchChain } from '../core/SearchChain';
import { ThinkingChain } from '../core/ThinkingChain';
import { TodoChain } from '../tools/TodoChain';
import { GoalChain } from '../tools/GoalChain';
import { contextService } from '../../../services/ContextService';

export type ToolType = 'todo' | 'goal' | 'general';

interface OrchestratorInput {
  userInput: string;
  useWebSearch?: boolean;
  useDeepThinking?: boolean;
  history?: HistoryMessage[];
  toolType?: ToolType;
}

export class MainOrchestrator {
  private searchChain: SearchChain;
  private thinkingChain: ThinkingChain;
  private todoChain: TodoChain;
  private goalChain: GoalChain;

  constructor(private model: BaseChatModel) {
    this.searchChain = new SearchChain();
    this.thinkingChain = new ThinkingChain(model);
    this.todoChain = new TodoChain(model);
    this.goalChain = new GoalChain(model);
  }

  private async selectTool(
    input: string,
    useWebSearch: boolean,
  ): Promise<ToolType> {
    const todoKeywords = ['任务', '计划', 'todo', '待办', '清单', '安排'];
    const goalKeywords = ['目标', '学习', '兴趣', '教练', '规划', 'SMART'];
    const lowerInput = input.toLowerCase();

    if (todoKeywords.some(keyword => lowerInput.includes(keyword))) {
      return 'todo';
    }

    if (goalKeywords.some(keyword => lowerInput.includes(keyword))) {
      return 'goal';
    }

    return 'general';
  }

  async *stream(input: OrchestratorInput): AsyncGenerator<StreamChunk> {
    const {
      userInput,
      useWebSearch = false,
      useDeepThinking = false,
      history = [],
      toolType,
    } = input;

    const selectedTool =
      toolType || (await this.selectTool(userInput, useWebSearch));

    let searchContent = '';
    let searchResults: any[] = [];

    if (useWebSearch) {
      try {
        for await (const chunk of this.searchChain.stream(userInput, history)) {
          if (chunk.type === 'content') {
            searchContent += `${chunk.content}\n`;
          } else if (chunk.type === 'search') {
            yield {
              type: 'search',
              content: chunk.content,
              searchResults: (chunk as any).searchResults || [],
            };
          }
        }
      } catch (error) {
        console.error('搜索执行失败:', error);
        yield {
          type: 'content',
          content: '搜索过程中出现错误。',
        };
      }
    }

    switch (selectedTool) {
      case 'todo': {
        let thinkingContent = '';
        if (useDeepThinking) {
          for await (const chunk of this.thinkingChain.stream(
            userInput,
            searchContent,
            history,
            useDeepThinking,
          )) {
            if (chunk.type === 'thinking') {
              thinkingContent += chunk.content;
              yield chunk;
            }
          }
        }

        try {
          const todoData = await this.todoChain.invoke({
            userInput,
            searchContent,
            thinkingContent,
            history,
          });

          yield {
            type: 'tododata',
            content: '',
            todoData,
          };

          yield {
            type: 'content',
            content: `已为您生成任务计划："${todoData.title}"，包含 ${todoData.items.length} 个任务。`,
          };
        } catch (error) {
          console.error('TODO生成失败:', error);
          yield {
            type: 'content',
            content: '生成任务计划时出现错误。',
          };
        }
        break;
      }

      case 'goal': {
        let thinkingContent = '';
        if (useDeepThinking) {
          for await (const chunk of this.thinkingChain.stream(
            userInput,
            searchContent,
            history,
            useDeepThinking,
          )) {
            if (chunk.type === 'thinking') {
              thinkingContent += chunk.content;
              yield chunk;
            }
          }
        }

        try {
          const { interest, level } = contextService.extractInterestAndLevel(
            userInput,
            history,
          );

          for await (const chunk of this.goalChain.stream({
            userInput,
            searchContent,
            thinkingContent,
            history,
            level: level as 'beginner' | 'intermediate' | 'advanced',
          })) {
            yield chunk;
          }
        } catch (error) {
          console.error('Goal生成失败:', error);
          yield {
            type: 'content',
            content: '制定学习目标时出现错误。',
          };
        }
        break;
      }

      default: {
        yield* this.streamGeneralResponse(
          userInput,
          searchContent,
          history,
          useDeepThinking,
        );
      }
    }
  }

  private async *streamGeneralResponse(
    userInput: string,
    searchContent: string,
    history: HistoryMessage[],
    useDeepThinking: boolean,
  ): AsyncGenerator<StreamChunk> {
    try {
      const historyContext = contextService.buildHistoryContext(
        history,
        4,
        true,
      );

      const prompt = `你是一个专业的兴趣教练。${useDeepThinking ? '请先进行深度思考，然后回答用户问题：' : '基于以下信息回答用户问题：'}

用户当前问题：${userInput}
${historyContext}

${searchContent ? `**相关搜索信息：**\n${searchContent}\n` : ''}
${useDeepThinking ? '请先进行深度思考，然后基于思考给出专业建议：' : '请提供专业、实用的建议：'}`;

      if (this.model && typeof (this.model as any).streamRaw === 'function') {
        const messages = [
          { role: 'system', content: '你是一个专业的兴趣教练。' },
          { role: 'user', content: prompt },
        ];

        const streamGenerator = (this.model as any).streamRaw(messages, {
          stream: true,
          useDeepThinking,
        });

        for await (const chunk of streamGenerator) {
          if (chunk.type === 'content' && chunk.content) {
            yield { type: 'content', content: chunk.content };
          } else if (chunk.type === 'thinking' && chunk.content) {
            yield { type: 'thinking', content: chunk.content };
          }
        }
      } else {
        if (useDeepThinking) {
          let thinkingContent = '';
          for await (const chunk of this.thinkingChain.stream(
            userInput,
            searchContent,
            history,
            true,
          )) {
            if (chunk.type === 'thinking') {
              thinkingContent += chunk.content;
              yield chunk;
            }
          }

          const answerPrompt = `你是一个专业的兴趣教练。基于以下深度思考回答用户问题：

用户当前问题：${userInput}
${historyContext}

深度思考：
${thinkingContent}

${searchContent ? `**相关搜索信息：**\n${searchContent}\n` : ''}

请基于以上思考给出专业建议：`;

          const response = await this.model.invoke([
            { type: 'system', content: '你是一个专业的兴趣教练。' },
            { type: 'human', content: answerPrompt },
          ]);

          yield { type: 'content', content: response.content as string };
        } else {
          const response = await this.model.invoke([
            { type: 'system', content: '你是一个专业的兴趣教练。' },
            { type: 'human', content: prompt },
          ]);

          yield { type: 'content', content: response.content as string };
        }
      }
    } catch (error) {
      console.error('通用回答生成失败:', error);
      yield {
        type: 'content',
        content: '生成回答时出现错误。',
      };
    }
  }

  async invoke(input: OrchestratorInput): Promise<{
    content: string;
    toolType: ToolType;
    todoData?: TodoListData;
    searchContent?: string;
    thinkingContent?: string;
  }> {
    const {
      userInput,
      useWebSearch = false,
      useDeepThinking = false,
      history = [],
    } = input;

    const selectedTool = await this.selectTool(userInput, useWebSearch);
    let searchContent = '';
    let thinkingContent = '';

    if (useWebSearch) {
      const searchResult = await this.searchChain.execute(userInput, history);
      if (searchResult.success) {
        searchContent = searchResult.content;
      }
    }

    if (useDeepThinking) {
      thinkingContent = await this.thinkingChain.execute(
        userInput,
        searchContent,
        history,
      );
    }

    switch (selectedTool) {
      case 'todo': {
        const todoData = await this.todoChain.invoke({
          userInput,
          searchContent,
          thinkingContent,
          history,
        });

        return {
          content: `已为您生成任务计划："${todoData.title}"，包含 ${todoData.items.length} 个任务。`,
          toolType: 'todo',
          todoData,
          searchContent,
          thinkingContent,
        };
      }

      case 'goal': {
        const { interest, level } = contextService.extractInterestAndLevel(
          userInput,
          history,
        );
        const goalContent = await this.goalChain.invoke({
          userInput,
          searchContent,
          thinkingContent,
          history,
          level: level as 'beginner' | 'intermediate' | 'advanced',
        });

        return {
          content: goalContent,
          toolType: 'goal',
          searchContent,
          thinkingContent,
        };
      }

      default: {
        const historyContext = contextService.buildHistoryContext(
          history,
          4,
          true,
        );
        const prompt = `你是一个专业的兴趣教练。基于以下信息回答用户问题：

用户当前问题：${userInput}
${historyContext}

${searchContent ? `**相关搜索信息：**\n${searchContent}\n` : ''}
${thinkingContent ? `**深度分析：**\n${thinkingContent}\n` : ''}

请提供专业、实用的建议：`;

        const response = await this.model.invoke([
          { type: 'system', content: '你是一个专业的兴趣教练。' },
          { type: 'human', content: prompt },
        ]);

        return {
          content: response.content as string,
          toolType: 'general',
          searchContent,
          thinkingContent,
        };
      }
    }
  }
}
