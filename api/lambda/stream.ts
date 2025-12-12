import serviceFactory from '../../src/services/index';
import type { RequestData, Message } from '../../src/types';

/**
 * 流式聊天端点
 * 原始文件重构，保持接口不变
 */
export const post = async ({ data }: { data: RequestData }) => {
  console.log('=== 流式端点开始处理 ===');
  const {
    message: userInput,
    conversationId,
    useDeepThinking = false,
    useWebSearch = false,
    history = [],
  } = data;

  console.log('接收到的消息:', userInput.substring(0, 100));
  console.log('对话ID:', conversationId);
  console.log('深度思考模式:', useDeepThinking ? '开启' : '关闭');
  console.log('网络搜索模式:', useWebSearch ? '开启' : '关闭');
  console.log('历史记录长度:', history.length);

  const encoder = new TextEncoder();
  const streamHandler = serviceFactory.stream.createHandler();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: any) => {
        const data = `data: ${JSON.stringify(obj)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // 1. 保存用户消息到数据库
        if (conversationId && !conversationId.startsWith('local-')) {
          try {
            const userMessage: Message = {
              id: serviceFactory.utils.generateId(),
              content: userInput,
              role: 'user',
              timestamp: new Date(),
            };

            const userId = serviceFactory.utils.getUserId();
            console.log(`保存用户消息到对话 ${conversationId}`);

            const result = await serviceFactory.conversation.addMessage(
              userId,
              conversationId,
              userMessage,
            );

            if (result) {
              push({
                type: 'metadata',
                content: '用户消息已保存',
                conversationId: conversationId,
                messageCount: result.messages?.length || 0,
              });
            }
          } catch (error) {
            console.error('保存用户消息时出错:', error);
          }
        }

        // 2. 处理AI回复
        let aiContent = '';
        let aiThinking = '';
        let aiSearchInfo = '';
        let aiSearchResults: any[] = [];
        let aiSearchTime = 0;
        let todoData: any;

        for await (const chunk of streamHandler(data)) {
          push(chunk);

          // 收集AI回复内容
          if (chunk.type === 'content') {
            aiContent += chunk.content || '';
          } else if (chunk.type === 'thinking') {
            aiThinking += chunk.content || '';
          } else if (chunk.type === 'search') {
            aiSearchInfo = chunk.content || '';
            aiSearchResults = chunk.searchResults || [];
            aiSearchTime = chunk.searchTime || 0;
          } else if (chunk.type === 'tododata') {
            todoData = chunk.todoData;
          }
        }

        // 3. 保存AI回复到数据库
        if (
          conversationId &&
          !conversationId.startsWith('local-') &&
          (aiContent || todoData)
        ) {
          try {
            const aiMessage: Message = {
              id: serviceFactory.utils.generateId(),
              content: aiContent || '已生成TODO列表',
              role: 'assistant',
              timestamp: new Date(),
              thinking: aiThinking || undefined,
              searchInfo: aiSearchInfo || undefined,
              searchResults:
                aiSearchResults.length > 0 ? aiSearchResults : undefined,
              searchTime: aiSearchTime || undefined,
              todoData: todoData || undefined,
            };

            const userId = serviceFactory.utils.getUserId();
            console.log(`保存AI回复到对话 ${conversationId}`);

            const result = await serviceFactory.conversation.addMessage(
              userId,
              conversationId,
              aiMessage,
            );

            if (result) {
              push({
                type: 'metadata',
                content: '对话已保存',
                conversationId: conversationId,
                messageCount: result.messages?.length || 0,
                isLocal: false,
              });
            }
          } catch (error) {
            console.error('保存AI回复时出错:', error);
            push({
              type: 'thinking',
              content: '保存对话时遇到问题，但回复已生成',
            });
          }
        } else if (conversationId?.startsWith('local-')) {
          push({
            type: 'metadata',
            content: '本地对话已更新',
            conversationId: conversationId,
            isLocal: true,
          });
        } else if (!aiContent && !todoData) {
          console.warn('AI回复和TODO数据都为空，跳过保存');
        }

        console.log('流处理完成');
      } catch (error) {
        console.error('处理过程中出错:', error);
        push({
          type: 'error',
          content: `服务调用失败: ${error instanceof Error ? error.message : '未知错误，请检查网络连接或服务配置'}`,
        });
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
