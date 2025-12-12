import type {
  SearchResult,
  HistoryMessage,
  SearchResultItem,
} from '../../../types';
import { createSearchTool } from '../../tools/searchTool';
import { contextService } from '../../../services/ContextService';

export class SearchChain {
  private searchTool;

  constructor() {
    this.searchTool = createSearchTool();
  }

  async execute(
    userInput: string,
    history: HistoryMessage[] = [],
  ): Promise<SearchResult> {
    try {
      const query = contextService.buildSearchQuery(
        'search',
        userInput,
        history,
      );
      const result = await this.searchTool.invoke({
        query,
        maxResults: 5,
      });

      const searchResult: SearchResult = JSON.parse(result);

      if (
        searchResult.success &&
        searchResult.results &&
        searchResult.results.length > 0
      ) {
        if (
          !searchResult.content ||
          searchResult.content === '未找到相关信息'
        ) {
          searchResult.content = this.formatSearchResultsForDisplay(
            searchResult.results,
          );
        }
      }

      return searchResult;
    } catch (error) {
      console.error('搜索链执行失败:', error);
      return {
        success: false,
        content: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`,
        results: [],
        sources: [],
      };
    }
  }

  async *stream(
    userInput: string,
    history: HistoryMessage[] = [],
  ): AsyncGenerator<
    | { type: 'search'; content: string; searchResults?: SearchResultItem[] }
    | { type: 'content'; content: string }
    | { type: 'error'; content: string },
    void
  > {
    yield { type: 'search', content: '正在搜索最新信息...' };

    try {
      const searchResult = await this.execute(userInput, history);

      if (searchResult.success) {
        yield {
          type: 'search',
          content: `搜索完成，找到 ${searchResult.results?.length || 0} 条相关信息`,
          searchResults: searchResult.results || [],
        };

        if (
          searchResult.content &&
          searchResult.results &&
          searchResult.results.length > 0
        ) {
          yield {
            type: 'content',
            content: this.formatSearchResultsForRender(searchResult.results),
          };

          yield {
            type: 'content',
            content: `\n**搜索结果摘要：**\n${this.formatSearchResultsForDisplay(searchResult.results)}`,
          };
        } else if (searchResult.content) {
          yield { type: 'content', content: searchResult.content };
        }
      } else {
        yield {
          type: 'content',
          content: '搜索失败，将基于现有知识回答。',
        };
      }
    } catch (error) {
      console.error('流式搜索失败:', error);
      yield {
        type: 'error',
        content: `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  private formatSearchResultsForRender(results: SearchResultItem[]): string {
    if (results.length === 0) {
      return '';
    }

    return `[SEARCH_RESULTS_START]${JSON.stringify(results)}[SEARCH_RESULTS_END]`;
  }

  private formatSearchResultsForDisplay(results: SearchResultItem[]): string {
    if (results.length === 0) {
      return '未找到相关信息。';
    }

    let formatted = '**搜索结果：**\n\n';
    results.forEach((item, index) => {
      formatted += `${index + 1}. **${item.title || '无标题'}**\n`;

      const content = item.content || '无内容';
      const maxLength = 200;
      const displayContent =
        content.length > maxLength
          ? `${content.substring(0, maxLength)}...`
          : content;

      formatted += `   ${displayContent}\n`;

      if (item.url) {
        formatted += `   来源: ${item.url}\n`;
      }

      if (item.score !== undefined) {
        formatted += `   相关性: ${(item.score * 100).toFixed(1)}%\n`;
      }

      formatted += '\n';
    });

    return formatted;
  }
}
