import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { HistoryMessage, StreamChunk } from '../../../types';
import { contextService } from '../../../services/ContextService';

export class ThinkingChain {
  constructor(private model: BaseChatModel) {}

  private buildThinkingPrompt(
    userInput: string,
    searchContent: string,
    history: HistoryMessage[],
  ): string {
    const historyContext = contextService.buildHistoryContext(history, 3, true);

    return `你是一个专业的分析师，请基于对话历史展示你的思考过程。

用户当前需求：${userInput}
${historyContext}

${searchContent ? `相关搜索信息：\n${searchContent}\n` : ''}

请从以下几个方面进行深度分析：
1. 基于对话历史，需求的核心目标是什么？
2. 需要哪些关键步骤？
3. 可能的难点和挑战是什么？
4. 如何合理分配时间和优先级？
5. 最佳实践和建议是什么？

请详细分析：`;
  }

  async *stream(
    userInput: string,
    searchContent = '',
    history: HistoryMessage[] = [],
    useDeepThinking = false,
  ): AsyncGenerator<StreamChunk> {
    if (!useDeepThinking) {
      return;
    }

    const systemMessage = new SystemMessage(
      '你是一个专业的分析师，请基于对话历史展示你的思考过程。',
    );

    const historyMessages = history.map(msg =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    );

    const thinkingPrompt = this.buildThinkingPrompt(
      userInput,
      searchContent,
      history,
    );
    const currentMessage = new HumanMessage(thinkingPrompt);

    const allMessages = [systemMessage, ...historyMessages, currentMessage];

    try {
      if (this.model && typeof (this.model as any).streamRaw === 'function') {
        const streamGenerator = (this.model as any).streamRaw(allMessages, {
          stream: true,
          useDeepThinking: true,
        });

        for await (const chunk of streamGenerator) {
          if (chunk.type === 'thinking' && chunk.content) {
            yield { type: 'thinking', content: chunk.content };
          }
        }
      } else {
        // 降级方案：直接生成思考内容
        const response = await this.model.invoke(allMessages);
        yield { type: 'thinking', content: response.content as string };
      }
    } catch (error) {
      console.error('思考链流式输出失败:', error);
      yield {
        type: 'thinking',
        content: '深度思考过程出现错误。',
      };
    }
  }

  async execute(
    userInput: string,
    searchContent = '',
    history: HistoryMessage[] = [],
  ): Promise<string> {
    const systemMessage = new SystemMessage(
      '你是一个专业的分析师，请基于对话历史展示你的思考过程。',
    );

    const thinkingPrompt = this.buildThinkingPrompt(
      userInput,
      searchContent,
      history,
    );
    const currentMessage = new HumanMessage(thinkingPrompt);

    try {
      const response = await this.model.invoke([systemMessage, currentMessage]);
      return response.content as string;
    } catch (error) {
      console.error('思考链执行失败:', error);
      return '深度思考过程出现错误。';
    }
  }
}
