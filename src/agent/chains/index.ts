import { DoubaoLangChain } from '../../models/doubao_langchain';
import { MainOrchestrator } from './orchestrator/MainOrchestrator';

export { MainOrchestrator };
export { SearchChain } from './core/SearchChain';
export { ThinkingChain } from './core/ThinkingChain';
export { TodoChain } from './tools/TodoChain';
export { GoalChain } from './tools/GoalChain';

export const createOrchestrator = (apiKey?: string): MainOrchestrator => {
  const volcengineApiKey = apiKey || process.env.VOLCENGINE_API_KEY;

  if (!volcengineApiKey) {
    throw new Error('VOLCENGINE_API_KEY 环境变量未设置');
  }

  const model = new DoubaoLangChain({
    apiKey: volcengineApiKey,
    model: 'doubao-seed-1-6-251015',
    temperature: 0.7,
    maxTokens: 2000,
  });

  return new MainOrchestrator(model);
};

export const createInterestCoach = (apiKey?: string) => {
  const orchestrator = createOrchestrator(apiKey);

  return {
    invoke: async (input: any) => {
      const result = await orchestrator.invoke({
        userInput: input.input,
        useWebSearch: input.useWebSearch || false,
        useDeepThinking: input.useDeepThinking || false,
        history: input.history || [],
      });

      return {
        output: result.content,
        searchUsed: input.useWebSearch || false,
        deepThinkingUsed: input.useDeepThinking || false,
        todoData: result.todoData,
      };
    },

    invokeStream: async function* (input: any) {
      yield* orchestrator.stream({
        userInput: input.input,
        useWebSearch: input.useWebSearch || false,
        useDeepThinking: input.useDeepThinking || false,
        history: input.history || [],
      });
    },
  };
};
