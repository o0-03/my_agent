// file name: tools/SearchTool.ts (确保格式兼容)
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SearchResult, SearchResultItem } from '../../types';

export const createSearchTool = () => {
  return new DynamicStructuredTool({
    name: 'web_search',
    description: '在互联网上搜索最新信息',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
      maxResults: z.number().min(1).max(10).default(5).describe('最大结果数'),
    }),
    func: async ({ query, maxResults }): Promise<string> => {
      try {
        console.log(`🔍 开始搜索: "${query}"`);

        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          throw new Error('TAVILY_API_KEY 未设置');
        }

        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: apiKey,
            query: query,
            max_results: maxResults,
            include_answer: true,
            search_depth: 'advanced',
          }),
        });

        if (!response.ok) {
          throw new Error(`搜索失败: ${response.status}`);
        }

        const result = await response.json();

        const searchResults: SearchResultItem[] = (result.results || []).map(
          (item: any, index: number) => ({
            title: item.title || `结果 ${index + 1}`,
            url: item.url,
            content: item.content || '无内容',
            score: item.score,
          }),
        );

        let content = '';
        if (result.answer) {
          content = result.answer;
        } else if (searchResults.length > 0) {
          content = searchResults
            .map((item, idx) => `${idx + 1}. ${item.title}: ${item.content}`)
            .join('\n');
        } else {
          content = '未找到相关信息';
        }

        const searchResult: SearchResult = {
          success: true,
          content,
          results: searchResults,
          sources: (result.results || [])
            .map((item: any) => item.url)
            .filter(Boolean),
        };

        return JSON.stringify(searchResult);
      } catch (error) {
        console.error('搜索失败:', error);
        const errorResult: SearchResult = {
          success: false,
          content: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`,
          results: [],
          sources: [],
        };
        return JSON.stringify(errorResult);
      }
    },
  });
};
