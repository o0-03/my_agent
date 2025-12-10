import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentInput, StreamChunk } from '../types';
import { InterestCoachChain } from './chains/interestCoachChain';

export const createSimpleCoach = (model: BaseChatModel) => {
  const coachChain = new InterestCoachChain({ model });

  return {
    invoke: async (input: AgentInput) => {
      const userInput = input.input;
      const useWebSearch = input.useWebSearch || false;
      const useDeepThinking = input.useDeepThinking || false;
      const history = input.history || [];

      try {
        const result = await coachChain.invoke({
          userInput,
          useWebSearch,
          useDeepThinking,
          history,
        });

        return {
          output: result.response,
          searchUsed: result.toolUsed === 'search',
          deepThinkingUsed: useDeepThinking,
          todoData: result.data?.type === 'todo_list' ? result.data : undefined,
        };
      } catch (error) {
        console.error('调用失败:', error);
        throw error;
      }
    },

    invokeStream: async function* (
      input: AgentInput,
    ): AsyncGenerator<StreamChunk, void, unknown> {
      const userInput = input.input;
      const useWebSearch = input.useWebSearch || false;
      const useDeepThinking = input.useDeepThinking || false;
      const history = input.history || [];

      try {
        yield* coachChain.stream({
          userInput,
          useWebSearch,
          useDeepThinking,
          history,
        });
      } catch (error) {
        console.error('流式调用失败:', error);
        yield {
          type: 'content',
          content: `处理错误: ${error instanceof Error ? error.message : '未知错误'}`,
        };
      }
    },
  };
};

export { SYSTEM_PROMPT } from './chains/interestCoachChain';
