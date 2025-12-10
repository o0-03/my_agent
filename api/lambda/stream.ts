import { createChains } from 'src/agent';
import { addMessage } from '../../src/services/conversationService';
import type {
  PushData,
  RequestData,
  Message,
  TodoListData,
} from '../../src/types';

function getUserId(): string {
  return 'user_d4y6df';
}

export const post = async ({ data }: { data: RequestData }) => {
  console.log('=== BFF 开始处理 ===');
  const {
    message: userInput,
    conversationId,
    useDeepThinking = false,
    useWebSearch = false,
    history = [],
  } = data;

  console.log('接收到的消息:', userInput);
  console.log('对话ID:', conversationId);
  console.log('深度思考模式:', useDeepThinking ? '开启' : '关闭');
  console.log('网络搜索模式:', useWebSearch ? '开启' : '关闭');
  console.log('历史记录长度:', history.length);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: PushData) => {
        const data = `data: ${JSON.stringify(obj)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // 1. 首先保存用户消息到数据库
        if (conversationId && !conversationId.startsWith('local-')) {
          try {
            const userMessage: Message = {
              id: `user_${Date.now()}`,
              content: userInput,
              role: 'user',
              timestamp: new Date(),
            };

            const userId = getUserId();
            console.log(
              `保存用户消息到对话 ${conversationId}:`,
              userMessage.content.substring(0, 50),
            );

            const result = await addMessage(
              userId,
              conversationId,
              userMessage,
            );
            if (result) {
              console.log(
                '用户消息保存成功，对话现在有',
                result.messages?.length || 0,
                '条消息',
              );
              push({
                type: 'metadata',
                content: '用户消息已保存',
                conversationId: conversationId,
                messageCount: result.messages?.length || 0,
              });
            } else {
              console.warn('用户消息保存失败');
            }
          } catch (error) {
            console.error('保存用户消息时出错:', error);
          }
        }

        const chains = createChains();
        let aiContent = '';
        let aiThinking = '';
        let aiSearchInfo = '';
        let aiSearchResults: any[] = [];
        let aiSearchTime = 0;
        let todoData: TodoListData | undefined;

        let toolChunkCount = 0;
        const toolStartTime = Date.now();
        for await (const chunk of chains.interestCoachChain.stream({
          userInput,
          useWebSearch,
          useDeepThinking,
          history,
        })) {
          toolChunkCount++;

          // 处理不同类型的chunk
          if (chunk.type === 'thinking' && chunk.content.trim().length > 0) {
            aiThinking += chunk.content || '';
            push({
              type: 'thinking',
              content: chunk.content,
            });
          } else if (chunk.type === 'content') {
            aiContent += chunk.content || '';
            push({
              type: 'content',
              content: chunk.content,
            });
          } else if (chunk.type === 'search') {
            aiSearchInfo = chunk.content || '';
            aiSearchResults = chunk.searchResults || [];
            push({
              type: 'search',
              content: chunk.content,
              searchResults: chunk.searchResults,
              searchTime: chunk.searchTime,
            });
          } else if (chunk.type === 'tododata') {
            todoData = chunk.todoData;

            push({
              type: 'tododata',
              content: chunk.content || '',
              todoData: chunk.todoData,
            });
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
              id: `ai_${Date.now()}`,
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

            const userId = getUserId();
            console.log(
              `保存AI回复到对话 ${conversationId}:`,
              aiContent ? aiContent.substring(0, 50) : 'TODO数据',
              'hasTodoData:',
              !!todoData,
            );

            const result = await addMessage(userId, conversationId, aiMessage);
            if (result) {
              push({
                type: 'metadata',
                content: '对话已保存',
                conversationId: conversationId,
                messageCount: result.messages?.length || 0,
                isLocal: false,
              });
              console.log(
                'AI消息保存成功，对话现在有',
                result.messages?.length || 0,
                '条消息',
              );
            }
          } catch (error) {
            console.error('保存AI回复时出错:', error);
            push({
              type: 'thinking',
              content: '保存对话时遇到问题，但回复已生成',
            });
          }
        } else if (
          conversationId?.startsWith('local-') &&
          (aiContent || todoData)
        ) {
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
