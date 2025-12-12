import { createOrchestrator } from '../agent/chains/index';
import type { RequestData, PushData } from '../types';

export const createStreamHandler = (apiKey?: string) => {
  const orchestrator = createOrchestrator(apiKey);

  return async function* (requestData: RequestData): AsyncGenerator<PushData> {
    const {
      message: userInput,
      history = [],
      useWebSearch = false,
      useDeepThinking = false,
    } = requestData;

    console.log('流式服务开始处理:', {
      userInput: userInput.substring(0, 50),
      historyLength: history.length,
      useWebSearch,
      useDeepThinking,
    });

    try {
      for await (const chunk of orchestrator.stream({
        userInput,
        useWebSearch,
        useDeepThinking,
        history,
      })) {
        yield chunk;
      }
    } catch (error) {
      console.error('流式服务处理失败:', error);
      yield {
        type: 'error',
        content: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  };
};

export const createSyncHandler = (apiKey?: string) => {
  const orchestrator = createOrchestrator(apiKey);

  return async (requestData: RequestData) => {
    const {
      message: userInput,
      history = [],
      useWebSearch = false,
      useDeepThinking = false,
    } = requestData;

    console.log('同步服务开始处理:', {
      userInput: userInput.substring(0, 50),
      historyLength: history.length,
    });

    try {
      const result = await orchestrator.invoke({
        userInput,
        useWebSearch,
        useDeepThinking,
        history,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('同步服务处理失败:', error);
      return {
        success: false,
        error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  };
};
