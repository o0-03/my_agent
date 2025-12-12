// file name: services/ContextService.ts
import type { HistoryMessage, SearchResultItem } from '../types';

export const buildHistoryContext = (
  history: HistoryMessage[],
  maxMessages = 3,
  showIndex = true,
): string => {
  if (history.length === 0) {
    return '';
  }

  const title = showIndex ? '对话历史回顾：' : '对话上下文：';
  let context = `\n\n**${title}**\n`;

  const messages = history.slice(-maxMessages);
  messages.forEach((msg, index) => {
    const roleName = msg.role === 'user' ? '用户' : '助理';
    const prefix = showIndex ? `${index + 1}. ` : '';
    context += `${prefix}${roleName}: ${msg.content}\n`;
  });

  return context;
};

export const extractInterestAndLevel = (
  userInput: string,
  history: HistoryMessage[],
): { interest: string; level: string } => {
  const allText = [...history.map(h => h.content), userInput].join(' ');

  const interests = ['健身', '编程', '音乐', '绘画', '舞蹈', '烹饪', '阅读'];
  const levelKeywords = {
    beginner: ['新手', '初学者', '小白', '刚入门'],
    intermediate: ['中级', '有一定基础', '学过一些'],
    advanced: ['高级', '精通', '专家', '熟练'],
  };

  let foundInterest = '通用技能';
  for (const interest of interests) {
    if (allText.includes(interest)) {
      foundInterest = interest;
      break;
    }
  }

  let foundLevel = 'beginner';
  for (const [level, keywords] of Object.entries(levelKeywords)) {
    if (keywords.some(keyword => allText.includes(keyword))) {
      foundLevel = level;
      break;
    }
  }

  return { interest: foundInterest, level: foundLevel };
};

export const buildSearchQuery = (
  toolType: string,
  userInput: string,
  history: HistoryMessage[],
): string => {
  const { interest, level } = extractInterestAndLevel(userInput, history);

  const queryTemplates: Record<string, string> = {
    todo: `${userInput} 任务规划 最佳实践 时间管理`,
    goal: `${interest}学习目标 ${level}水平 最新方法`,
    search: userInput,
  };

  let baseQuery = queryTemplates[toolType] || userInput;

  if (history.length > 0) {
    const lastUserMessages = history
      .filter(h => h.role === 'user')
      .slice(-2)
      .map(h => h.content);
    if (lastUserMessages.length > 0) {
      baseQuery = `${baseQuery} ${lastUserMessages.join(' ')}`;
    }
  }

  return baseQuery;
};

export const formatSearchResults = (
  results: SearchResultItem[],
  includeSources = true,
): string => {
  if (results.length === 0) {
    return '未找到相关信息。';
  }

  let formatted = '';
  results.forEach((item, index) => {
    formatted += `${index + 1}. **${item.title}**\n`;
    formatted += `   ${item.content}\n`;
    if (includeSources && item.url) {
      formatted += `   来源: ${item.url}\n`;
    }
    formatted += '\n';
  });

  return formatted;
};

export const contextService = {
  buildHistoryContext,
  extractInterestAndLevel,
  buildSearchQuery,
  formatSearchResults,
};
