import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from '../lib/mongodb';
import { ConversationModel } from '../models/Conversation';
import type {
  Conversation,
  Message,
  TodoItem,
  HistoryMessage,
  SearchResultItem,
} from '../types';

// 工具函数
const formatMessageForSave = (message: Message): any => {
  const formattedMessage: any = {
    id: message.id,
    content: message.content,
    role: message.role,
    timestamp:
      message.timestamp instanceof Date
        ? message.timestamp
        : new Date(message.timestamp),
    isStreaming: message.isStreaming || false,
  };

  if (message.thinking) formattedMessage.thinking = message.thinking;
  if (message.currentStreamText)
    formattedMessage.currentStreamText = message.currentStreamText;
  if (message.thinkingTime)
    formattedMessage.thinkingTime = message.thinkingTime;
  if (message.searchInfo) formattedMessage.searchInfo = message.searchInfo;
  if (message.searchTime) formattedMessage.searchTime = message.searchTime;

  if (message.searchResults && Array.isArray(message.searchResults)) {
    formattedMessage.searchResults = message.searchResults.map(result => ({
      title: result.title || '',
      url: result.url || '',
      content: result.content || '',
      score: result.score || 0,
    }));
  } else {
    formattedMessage.searchResults = [];
  }

  if (message.todoData && message.todoData.type === 'todo_list') {
    const todoData = message.todoData;
    formattedMessage.todoData = {
      type: 'todo_list',
      title: todoData.title || '任务列表',
      items: todoData.items.map((item: TodoItem, index: number) => ({
        id: item.id || `todo_${Date.now()}_${index}`,
        content: item.content || '',
        priority: ['high', 'medium', 'low'].includes(item.priority)
          ? item.priority
          : 'medium',
        estimated_time:
          typeof item.estimated_time === 'number'
            ? Math.max(1, Math.min(item.estimated_time, 480))
            : 30,
        category: item.category || '默认',
        completed: item.completed || false,
      })),
    };
  }

  return formattedMessage;
};

const formatMessageFromDB = (message: any): Message => {
  const formattedMessage: Message = {
    id: message.id,
    content: message.content,
    role: message.role,
    timestamp:
      message.timestamp instanceof Date
        ? message.timestamp
        : new Date(message.timestamp),
    isStreaming: message.isStreaming || false,
  };

  if (message.thinking) formattedMessage.thinking = message.thinking;
  if (message.currentStreamText)
    formattedMessage.currentStreamText = message.currentStreamText;
  if (message.thinkingTime)
    formattedMessage.thinkingTime = message.thinkingTime;
  if (message.searchInfo) formattedMessage.searchInfo = message.searchInfo;
  if (message.searchTime) formattedMessage.searchTime = message.searchTime;

  if (message.searchResults && Array.isArray(message.searchResults)) {
    formattedMessage.searchResults = message.searchResults;
  }

  if (message.todoData && message.todoData.type === 'todo_list') {
    formattedMessage.todoData = {
      type: 'todo_list',
      title: message.todoData.title,
      items: message.todoData.items.map((item: any) => ({
        id: item.id,
        content: item.content,
        priority: item.priority,
        estimated_time: item.estimated_time,
        category: item.category,
        completed: item.completed || false,
      })),
    };
  }

  return formattedMessage;
};

const ensureConnection = async (): Promise<boolean> => {
  try {
    await connectToMongoDB();
    return true;
  } catch (error) {
    console.error('MongoDB 连接失败:', error);
    throw new Error('数据库连接失败');
  }
};

const buildHistoryContext = (
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

const extractInterestAndLevel = (
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

const buildSearchQuery = (
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

const formatSearchResults = (
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

// 对话服务函数
export async function getUserConversations(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<{
  conversations: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  console.log(`获取用户 ${userId} 的对话列表 - 第${page}页，每页${pageSize}条`);

  try {
    await ensureConnection();

    const skip = (page - 1) * pageSize;

    const [conversations, total] = await Promise.all([
      ConversationModel.find({
        userId,
        isArchived: false,
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      ConversationModel.countDocuments({
        userId,
        isArchived: false,
      }),
    ]);

    const hasMore = skip + conversations.length < total;

    console.log(
      `找到 ${conversations.length} 个对话，总数: ${total}, 还有更多: ${hasMore}`,
    );

    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      userId: conv.userId,
      messages: (conv.messages || []).map(formatMessageFromDB),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      isArchived: conv.isArchived || false,
    })) as Conversation[];

    return {
      conversations: formattedConversations,
      total,
      page,
      pageSize,
      hasMore,
    };
  } catch (error) {
    console.error('获取用户对话失败:', error);
    throw error;
  }
}

export async function getArchivedConversations(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<{
  conversations: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  try {
    await ensureConnection();

    const skip = (page - 1) * pageSize;
    const [conversations, total] = await Promise.all([
      ConversationModel.find({
        userId,
        isArchived: true,
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      ConversationModel.countDocuments({
        userId,
        isArchived: true,
      }),
    ]);

    const hasMore = skip + conversations.length < total;

    return {
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        userId: conv.userId,
        messages: (conv.messages || []).map(formatMessageFromDB),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        isArchived: conv.isArchived || false,
      })) as Conversation[],
      total,
      page,
      pageSize,
      hasMore,
    };
  } catch (error) {
    console.error('获取已归档对话失败:', error);
    throw error;
  }
}

export async function searchConversations(
  userId: string,
  query: string,
  page = 1,
  pageSize = 20,
): Promise<{
  conversations: Conversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  console.log(`搜索对话: "${query}" - 第${page}页`);

  try {
    await ensureConnection();

    const skip = (page - 1) * pageSize;

    const searchConditions = {
      userId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { 'messages.content': { $regex: query, $options: 'i' } },
      ],
      isArchived: false,
    };

    const [conversations, total] = await Promise.all([
      ConversationModel.find(searchConditions)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      ConversationModel.countDocuments(searchConditions),
    ]);

    const hasMore = skip + conversations.length < total;

    return {
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        userId: conv.userId,
        messages: (conv.messages || []).map(formatMessageFromDB),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        isArchived: conv.isArchived || false,
      })) as Conversation[],
      total,
      page,
      pageSize,
      hasMore,
    };
  } catch (error) {
    console.error('搜索对话失败:', error);
    throw error;
  }
}

export async function createConversation(
  userId: string,
  data: { title?: string; initialMessage?: string },
): Promise<Conversation> {
  console.log('创建对话:', {
    userId,
    title: data.title,
    initialMessageLength: data.initialMessage?.length,
  });

  try {
    await ensureConnection();

    const conversationId = uuidv4();
    const title =
      data.title ||
      (data.initialMessage
        ? data.initialMessage.substring(0, 20) +
          (data.initialMessage.length > 20 ? '...' : '')
        : '新对话');

    const conversation = new ConversationModel({
      id: conversationId,
      userId,
      title,
      messages: [],
      updatedAt: new Date(),
    });

    console.log(`保存到 MongoDB: ${conversationId}`);
    await conversation.save();

    console.log(`创建对话成功: ${conversationId} - "${title}"`);

    return {
      id: conversation.id,
      title: conversation.title,
      userId: conversation.userId,
      messages: (conversation.messages || []).map(formatMessageFromDB),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isArchived: conversation.isArchived || false,
    };
  } catch (error) {
    console.error('创建对话失败:', error);
    throw error;
  }
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<Conversation | null> {
  console.log(`获取对话: ${conversationId}`);

  try {
    await ensureConnection();

    const conversation = await ConversationModel.findOne({
      userId,
      id: conversationId,
    })
      .lean()
      .exec();

    if (!conversation) {
      console.log(`对话 ${conversationId} 不存在`);
      return null;
    }

    console.log(
      `加载对话 ${conversationId} 成功，消息数: ${conversation.messages?.length || 0}`,
    );

    return {
      id: conversation.id,
      title: conversation.title,
      userId: conversation.userId,
      messages: (conversation.messages || []).map(formatMessageFromDB),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isArchived: conversation.isArchived || false,
    } as Conversation;
  } catch (error) {
    console.error(`获取对话 ${conversationId} 失败:`, error);
    throw error;
  }
}

export async function addMessage(
  userId: string,
  conversationId: string,
  message: Message,
): Promise<Conversation | null> {
  console.log(`添加消息到对话 ${conversationId}`, {
    userId,
    messageId: message.id,
    contentPreview: `${message.content.substring(0, 30)}...`,
    hasTodoData: !!message.todoData,
  });

  try {
    await ensureConnection();

    const formattedMessage = formatMessageForSave(message);

    const conversation = await ConversationModel.findOneAndUpdate(
      { userId, id: conversationId },
      {
        $push: {
          messages: formattedMessage,
        },
        $set: {
          updatedAt: new Date(),
          title:
            message.role === 'user' && message.content.length > 0
              ? message.content.substring(0, 20) +
                (message.content.length > 20 ? '...' : '')
              : undefined,
        },
      },
      {
        new: true,
        upsert: false,
        runValidators: true,
      },
    )
      .lean()
      .exec();

    if (!conversation) {
      console.log(`对话 ${conversationId} 不存在，无法添加消息`);
      return null;
    }

    console.log(
      `消息成功添加到对话 ${conversationId}，现在有 ${conversation.messages?.length || 0} 条消息`,
    );

    return {
      id: conversation.id,
      title: conversation.title,
      userId: conversation.userId,
      messages: (conversation.messages || []).map(formatMessageFromDB),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isArchived: conversation.isArchived || false,
    } as Conversation;
  } catch (error: any) {
    console.error(`添加消息到对话 ${conversationId} 失败:`, error);
    throw error;
  }
}

export async function updateTitle(
  userId: string,
  conversationId: string,
  title: string,
): Promise<Conversation | null> {
  console.log(`更新对话标题: ${conversationId} -> "${title}"`);

  try {
    await ensureConnection();

    const conversation = await ConversationModel.findOneAndUpdate(
      { userId, id: conversationId },
      {
        $set: {
          title,
          updatedAt: new Date(),
        },
      },
      { new: true },
    )
      .lean()
      .exec();

    if (!conversation) {
      console.log(`对话 ${conversationId} 不存在`);
      return null;
    }

    console.log('对话标题更新成功');
    return {
      id: conversation.id,
      title: conversation.title,
      userId: conversation.userId,
      messages: (conversation.messages || []).map(formatMessageFromDB),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isArchived: conversation.isArchived || false,
    } as Conversation;
  } catch (error) {
    console.error('更新对话标题失败:', error);
    throw error;
  }
}

export async function archiveConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  try {
    await ensureConnection();

    const result = await ConversationModel.updateOne(
      { userId, id: conversationId },
      {
        $set: {
          isArchived: true,
          updatedAt: new Date(),
        },
      },
    ).exec();

    const success = result.modifiedCount > 0;
    console.log(`归档对话 ${conversationId}: ${success ? '成功' : '失败'}`);
    return success;
  } catch (error) {
    console.error('归档对话失败:', error);
    throw error;
  }
}

export async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  console.log(`删除对话: ${conversationId}`);

  try {
    await ensureConnection();

    const result = await ConversationModel.deleteOne({
      userId,
      id: conversationId,
    }).exec();

    const success = result.deletedCount > 0;
    console.log(`删除对话 ${conversationId}: ${success ? '成功' : '失败'}`);
    return success;
  } catch (error) {
    console.error('删除对话失败:', error);
    throw error;
  }
}

export const contextUtils = {
  buildHistoryContext,
  extractInterestAndLevel,
  buildSearchQuery,
  formatSearchResults,
};

export const conversationService = {
  getUserConversations,
  getArchivedConversations,
  searchConversations,
  createConversation,
  getConversation,
  addMessage,
  updateTitle,
  archiveConversation,
  deleteConversation,
  contextUtils,
};

export default conversationService;
