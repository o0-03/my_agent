import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import {
  type BaseMessage,
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import type { StreamChunk } from '../types';

export interface DoubaoCallOptions extends BaseChatModelCallOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  useDeepThinking?: boolean;
}

interface DoubaoLangChainOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

export class DoubaoLangChain extends BaseChatModel<DoubaoCallOptions> {
  private apiKey: string;
  private model: string;
  private endpoint: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: DoubaoLangChainOptions) {
    super({});
    this.apiKey = options.apiKey;
    this.model = options.model || 'doubao-seed-1-6-251015';
    this.endpoint =
      options.endpoint ||
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 2000;
  }

  bind(options: any) {
    return new DoubaoLangChain({
      apiKey: this.apiKey,
      model: this.model,
      endpoint: this.endpoint,
      temperature: options.temperature ?? this.temperature,
      maxTokens: options.maxTokens ?? this.maxTokens,
    });
  }

  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
  ): Promise<ChatResult> {
    let fullContent = '';
    for await (const chunk of this._streamResponse(messages, options)) {
      if (chunk.type === 'content') {
        fullContent += chunk.content;
      }
    }

    return {
      generations: [
        {
          message: new AIMessage(fullContent),
          text: fullContent,
        },
      ],
    };
  }

  private mapMessageTypeToRole(type: string): string {
    switch (type) {
      case 'human':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'system':
        return 'system';
      default:
        return 'user';
    }
  }

  private formatMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join('\n');
    }
    return JSON.stringify(content);
  }

  _llmType(): string {
    return 'doubao-langchain';
  }

  _modelType(): string {
    return this.model;
  }

  async *_streamResponse(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
  ): AsyncGenerator<StreamChunk> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('消息必须是 BaseMessage 数组');
    }

    const firstMsg = messages[0];
    if (typeof (firstMsg as any)._getType !== 'function') {
      console.error('消息格式错误，不是 BaseMessage:', firstMsg);
      throw new Error('消息必须是 BaseMessage 对象');
    }

    const formattedMessages = messages.map(msg => ({
      role: this.mapMessageTypeToRole(msg._getType()),
      content: this.formatMessageContent(msg.content),
    }));

    const requestBody: any = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.maxTokens ?? this.maxTokens,
    };

    if (options?.useDeepThinking) {
      requestBody.thinking = {
        type: 'enabled',
        emit: true,
        budget_tokens: 2000,
      };
      console.log('🎯 深度思考模式: ENABLED (emit: true)');
    } else {
      requestBody.thinking = {
        type: 'disabled',
      };
      console.log('🎯 深度思考模式: DISABLED');
    }
    const startTime = Date.now();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`API响应时间: ${Date.now() - startTime}ms`);
    console.log('响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API错误详情:', errorText);
      throw new Error(`豆包 API 错误: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('响应体为空，无法进行流式处理');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let totalBytes = 0;

    try {
      while (true) {
        chunkCount++;
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        totalBytes += value.length;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);

            try {
              const data = JSON.parse(dataStr);

              if (data.choices?.[0]?.delta?.reasoning_content) {
                const thinkingChunk = data.choices[0].delta.reasoning_content;

                yield {
                  type: 'thinking',
                  content: thinkingChunk,
                };
              }

              if (data.choices?.[0]?.delta?.content) {
                const contentChunk = data.choices[0].delta.content;

                yield {
                  type: 'content',
                  content: contentChunk,
                };
              }
            } catch (e) {
              console.error('解析流数据失败:', e);
              console.error('原始数据:', dataStr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async stream(
    input: BaseMessage[] | string,
    options?: DoubaoCallOptions,
  ): Promise<IterableReadableStream<AIMessageChunk>> {
    const messages = Array.isArray(input) ? input : [new HumanMessage(input)];

    const generator = this._streamResponse(messages, options);

    return new IterableReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            if (chunk.type === 'content') {
              const messageChunk = new AIMessageChunk(chunk.content);
              controller.enqueue(messageChunk);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async *streamRaw(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
  ): AsyncGenerator<StreamChunk> {
    const streamOptions = {
      ...options,
      stream: true,
    };
    yield* this._streamResponse(messages, streamOptions);
  }

  async debugApiCall(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
  ): Promise<any> {
    const formattedMessages = messages.map(msg => ({
      role: this.mapMessageTypeToRole(msg._getType()),
      content: this.formatMessageContent(msg.content),
    }));

    const requestBody: any = {
      model: this.model,
      messages: formattedMessages,
      stream: false,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.maxTokens ?? this.maxTokens,
    };

    if (options?.useDeepThinking) {
      requestBody.thinking = {
        type: 'enabled',
        emit: true,
        budget_tokens: 2000,
      };
    } else {
      requestBody.thinking = {
        type: 'disabled',
      };
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆包 API 错误: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    return responseData;
  }
}
