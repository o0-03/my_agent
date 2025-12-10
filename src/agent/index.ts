import { DoubaoLangChain } from './doubao_langchain';
import { createSimpleCoach } from './interestCoach';
import { InterestCoachChain } from './chains/interestCoachChain';
import { TodoChain } from './chains/todoChain';

// 导出所有链和工具
export { createSimpleCoach, InterestCoachChain, TodoChain };

const createModel = (apiKey?: string): DoubaoLangChain => {
  const volcengineApiKey = apiKey || process.env.VOLCENGINE_API_KEY;

  if (!volcengineApiKey) {
    throw new Error('VOLCENGINE_API_KEY 环境变量未设置');
  }

  return new DoubaoLangChain({
    apiKey: volcengineApiKey,
    model: 'doubao-seed-1-6-251015',
    temperature: 0.7,
    maxTokens: 2000,
  });
};

export const createInterestCoach = (apiKey?: string) => {
  const model = createModel(apiKey);
  return createSimpleCoach(model);
};

export const createChains = (apiKey?: string) => {
  const model = createModel(apiKey);

  return {
    interestCoachChain: new InterestCoachChain({ model }),
    todoChain: new TodoChain({ model }),
  };
};
