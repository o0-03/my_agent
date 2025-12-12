import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { HistoryMessage, StreamChunk } from '../../../types';
import { contextService } from '../../../services/ContextService';

interface GoalChainInput {
  userInput: string;
  searchContent?: string;
  thinkingContent?: string;
  history?: HistoryMessage[];
  level?: 'beginner' | 'intermediate' | 'advanced';
  timeframe?: string;
}

export class GoalChain {
  constructor(private model: BaseChatModel) {}

  private buildGoalPrompt(input: GoalChainInput): string {
    const {
      userInput,
      searchContent = '',
      thinkingContent = '',
      history = [],
      level = 'beginner',
      timeframe = '一个月',
    } = input;

    const historyContext = contextService.buildHistoryContext(history, 3, true);
    const { interest } = contextService.extractInterestAndLevel(
      userInput,
      history,
    );

    let prompt = `作为专业兴趣教练，请为用户制定个性化的${timeframe}学习目标。

用户信息：
- 兴趣领域：${interest}
- 当前水平：${level}
- 时间框架：${timeframe}${historyContext}`;

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

请生成具体、可衡量、可实现、相关、有时限的(SMART)目标。
请使用Markdown格式组织你的回答，包括：
1. **总体目标** - 简洁的总体描述
2. **具体目标** - 3-5个具体可衡量的目标
3. **时间安排** - ${timeframe}的时间规划
4. **评估标准** - 如何评估进度和成功
5. **资源建议** - 推荐的学习资源`;

    return prompt;
  }

  async *stream(input: GoalChainInput): AsyncGenerator<StreamChunk> {
    const prompt = this.buildGoalPrompt(input);

    const systemMessage = new SystemMessage(
      '你是一个专业的兴趣教练，擅长制定学习计划和目标。',
    );
    const currentMessage = new HumanMessage(prompt);

    const allMessages = [systemMessage, currentMessage];

    try {
      if (this.model && typeof (this.model as any).streamRaw === 'function') {
        const streamGenerator = (this.model as any).streamRaw(allMessages, {
          stream: true,
          useDeepThinking: false,
        });

        for await (const chunk of streamGenerator) {
          if (chunk.type === 'content' && chunk.content) {
            yield { type: 'content', content: chunk.content };
          }
        }
      } else {
        const response = await this.model.invoke(allMessages);
        yield { type: 'content', content: response.content as string };
      }
    } catch (error) {
      console.error('Goal链流式输出失败:', error);
      yield {
        type: 'content',
        content: '制定学习目标时出现错误。',
      };
    }
  }

  async invoke(input: GoalChainInput): Promise<string> {
    const prompt = this.buildGoalPrompt(input);

    const systemMessage = new SystemMessage(
      '你是一个专业的兴趣教练，擅长制定学习计划和目标。',
    );

    try {
      const response = await this.model.invoke([
        systemMessage,
        new HumanMessage(prompt),
      ]);
      return response.content as string;
    } catch (error) {
      console.error('Goal链执行失败:', error);
      return '制定学习目标时出现错误。';
    }
  }
}
