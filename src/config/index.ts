export const config = {
  // API 配置
  api: {
    doubao: {
      model: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-251015',
      temperature: process.env.DOUBAO_TEMPERATURE
        ? Number.parseFloat(process.env.DOUBAO_TEMPERATURE)
        : 0.7,
      maxTokens: process.env.DOUBAO_MAX_TOKENS
        ? Number.parseInt(process.env.DOUBAO_MAX_TOKENS)
        : 2000,
      endpoint:
        process.env.DOUBAO_ENDPOINT ||
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    },
    tavily: {
      maxResults: 5,
      searchDepth: 'basic' as const,
    },
  },

  // 数据库配置
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DB_NAME || 'my_agent',
      collections: {
        conversations: 'conversations',
        messages: 'messages',
      },
    },
  },

  // 功能配置
  features: {
    maxHistoryLength: 6,
    cacheDuration: 5 * 60 * 1000,
    maxRetries: 3,
    thinkingBudgetTokens: 2000,
  },

  app: {
    name: 'My Agent',
    version: '1.0.0',
  },
};

export type AppConfig = typeof config;
