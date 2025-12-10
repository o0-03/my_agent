// api/lambda/conversations.ts
import {
  getUserConversations,
  getArchivedConversations,
  searchConversations,
  createConversation,
  getConversation,
  deleteConversation,
  archiveConversation,
} from '../../src/services/conversationService';
import type { Conversation, CreateConversationData } from '../../src/types';

// 获取用户ID
function getUserId(request: Request): string {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `user_${hashCode(ip + userAgent)}`;
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

// GET /api/conversations
export const get = async ({ query }: { query: Record<string, string> }) => {
  try {
    const userId = getUserId(new Request('http://localhost'));
    console.log('用户ID:', userId);

    // 解析分页参数
    const page = Number.parseInt(query.page || '1');
    const pageSize = Number.parseInt(query.pageSize || '20');
    const search = query.search || '';
    const archived = query.archived === 'true';
    const conversationId = query.id;

    let result: { conversations: Conversation[]; total: number };
    let currentConversation: Conversation | null = null;

    if (search) {
      result = await searchConversations(userId, search, page, pageSize);
    } else if (archived) {
      result = await getArchivedConversations(userId, page, pageSize);
    } else {
      result = await getUserConversations(userId, page, pageSize);
    }

    // 如果指定了对话ID，加载该对话的详细信息
    if (conversationId) {
      currentConversation = await getConversation(userId, conversationId);

      if (currentConversation) {
        const todoMessages =
          currentConversation.messages?.filter(msg => msg.todoData) || [];

        if (todoMessages.length > 0) {
          todoMessages.forEach((msg, index) => {
            console.log(
              `  ${index + 1}. ${msg.todoData?.title}: ${msg.todoData?.items.length} 个任务`,
            );
          });
        }
      } else {
        console.log(`对话 ${conversationId} 不存在`);
      }
    }

    return {
      success: true,
      data: {
        ...result,
        currentConversation,
        currentConversationId: conversationId || null,
      },
    };
  } catch (error) {
    console.error('获取对话列表失败:', error);
    return {
      success: false,
      error: '获取对话列表失败',
      details: error instanceof Error ? error.message : '未知错误',
    };
  }
};

export const post = async ({ data }: { data: CreateConversationData }) => {
  console.log('POST /api/conversations lambda 被调用');
  console.log('请求数据:', data);

  try {
    const userId = getUserId(new Request('http://localhost'));
    const conversation = await createConversation(userId, data);

    return {
      success: true,
      data: conversation,
    };
  } catch (error) {
    console.error('创建对话失败:', error);
    return {
      success: false,
      error: '创建对话失败',
      details: error instanceof Error ? error.message : '未知错误',
    };
  }
};

export const archive = async ({
  params,
}: { params: Record<string, string>; query: Record<string, string> }) => {
  try {
    const userId = getUserId(new Request('http://localhost'));
    const conversationId = params.id;

    if (!conversationId) {
      return {
        success: false,
        error: '对话ID不能为空',
      };
    }

    const success = await archiveConversation(userId, conversationId);

    return {
      success,
      message: success ? '对话归档成功' : '对话不存在',
    };
  } catch (error) {
    console.error('归档对话失败:', error);
    return {
      success: false,
      error: '归档对话失败',
      details: error instanceof Error ? error.message : '未知错误',
    };
  }
};

// DELETE /api/conversations
export const del = async ({ query }: { query: Record<string, string> }) => {
  try {
    const userId = getUserId(new Request('http://localhost'));
    const conversationId = query.id;

    if (!conversationId) {
      return {
        success: false,
        error: '对话ID不能为空',
      };
    }

    const success = await deleteConversation(userId, conversationId);

    return {
      success,
      message: success ? '对话删除成功' : '对话不存在',
    };
  } catch (error) {
    console.error('删除对话失败:', error);
    return {
      success: false,
      error: '删除对话失败',
      details: error instanceof Error ? error.message : '未知错误',
    };
  }
};
