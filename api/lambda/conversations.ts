import serviceFactory from '../../src/services/conversationService';
import type { Conversation } from '../../src/types';

// 获取用户ID（简化版）
function getUserId(): string {
  // 在实际应用中应从请求中获取
  return 'user_d4y6df';
}

export const get = async (request: any) => {
  try {
    // 正确提取查询参数
    const query = request.query || {};
    const userId = getUserId();

    // 解析分页参数
    const page = Number.parseInt(query.page || '1');
    const pageSize = Number.parseInt(query.pageSize || '20');
    const search = query.search || '';
    const archived = query.archived === 'true';
    const conversationId = query.id; // 现在能正确获取了

    // 其余代码保持不变...
    let result: {
      conversations: Conversation[];
      total: number;
      page: number;
      pageSize: number;
      hasMore: boolean;
    };

    let currentConversation: Conversation | null = null;

    if (search) {
      result = await serviceFactory.searchConversations(
        userId,
        search,
        page,
        pageSize,
      );
    } else if (archived) {
      result = await serviceFactory.getArchivedConversations(
        userId,
        page,
        pageSize,
      );
    } else {
      result = await serviceFactory.getUserConversations(
        userId,
        page,
        pageSize,
      );
    }

    if (conversationId) {
      currentConversation = await serviceFactory.getConversation(
        userId,
        conversationId,
      );
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
// POST /api/conversations
export const post = async (request: any) => {
  console.log('创建新对话:', request);

  try {
    const data = request.body || {};
    const userId = getUserId();
    const conversation = await serviceFactory.createConversation(userId, data);

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

// PUT /api/conversations/:id/archive
export const archive = async (request: any) => {
  try {
    const userId = getUserId();
    const conversationId = request.params?.id || request.query?.id;

    if (!conversationId) {
      return {
        success: false,
        error: '对话ID不能为空',
      };
    }

    const success = await serviceFactory.archiveConversation(
      userId,
      conversationId,
    );

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

// DELETE /api/conversations/:id
export const del = async (request: any) => {
  try {
    const userId = getUserId();
    const conversationId = request.params?.id || request.query?.id;

    if (!conversationId) {
      return {
        success: false,
        error: '对话ID不能为空',
      };
    }

    const success = await serviceFactory.deleteConversation(
      userId,
      conversationId,
    );

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
