import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const createGoalTool = (model: BaseChatModel) => {
  return new DynamicStructuredTool({
    name: 'create_learning_goal',
    description: '为兴趣学习创建结构化目标',
    schema: z.object({
      interest: z.string().describe('兴趣领域'),
      level: z
        .enum(['beginner', 'intermediate', 'advanced'])
        .describe('当前水平'),
      timeframe: z.string().optional().describe('时间框架，如"一个月"'),
      specificNeeds: z.string().optional().describe('特殊需求'),
    }),
    func: async ({
      interest,
      level,
      timeframe = '一个月',
      specificNeeds = '',
    }) => {
      try {
        console.log(`🎯 创建学习目标: ${interest}, 水平: ${level}`);

        const prompt = `作为专业兴趣教练，请为用户制定个性化的${timeframe}学习目标。

用户信息：
- 兴趣领域：${interest}
- 当前水平：${level}
- 特殊需求：${specificNeeds || '无'}

请生成具体、可衡量、可实现、相关、有时限的(SMART)目标。
请使用Markdown格式组织你的回答，包括：
1. **总体目标** - 简洁的总体描述
2. **具体目标** - 3-5个具体可衡量的目标
3. **时间安排** - ${timeframe}的时间规划
4. **评估标准** - 如何评估进度和成功
5. **资源建议** - 推荐的学习资源`;

        const response = await model.invoke([
          {
            type: 'system',
            content: '你是一个专业的兴趣教练，擅长制定学习计划和目标。',
          },
          { type: 'human', content: prompt },
        ]);

        return response.content;
      } catch (error) {
        console.error('❌ 创建学习目标失败:', error);
        return `抱歉，创建学习目标时出现错误：${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
  });
};
