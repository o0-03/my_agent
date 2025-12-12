import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import {
  type BaseMessage,
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
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

  _llmType(): string {
    return 'doubao-langchain';
  }

  _modelType(): string {
    return this.model;
  }

  bind(options: Partial<DoubaoCallOptions>): DoubaoLangChain {
    return new DoubaoLangChain({
      apiKey: this.apiKey,
      model: this.model,
      endpoint: this.endpoint,
      temperature: options.temperature ?? this.temperature,
      maxTokens: options.maxTokens ?? this.maxTokens,
    });
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

  async _generate(
    messages: BaseMessage[],
    options?: DoubaoCallOptions,
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

  private convertToBaseMessages(messages: any[]): BaseMessage[] {
    return messages.map(msg => {
      const content = this.formatMessageContent(msg.content);

      switch (msg.role?.toLowerCase() || msg.type?.toLowerCase()) {
        case 'system':
          return new SystemMessage(content);
        case 'assistant':
        case 'ai':
          return new AIMessage(content);
        case 'user':
        case 'human':
        default:
          return new HumanMessage(content);
      }
    });
  }

  private async *_streamResponse(
    messages: any[],
    options?: DoubaoCallOptions,
  ): AsyncGenerator<StreamChunk> {
    // 转换消息为 BaseMessage
    const baseMessages = this.convertToBaseMessages(messages);

    const formattedMessages = baseMessages.map(msg => ({
      role: this.mapMessageTypeToRole(msg._getType()),
      content: this.formatMessageContent(msg.content),
    }));

    const requestBody = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      thinking: options?.useDeepThinking
        ? {
            type: 'enabled',
            emit: true,
            budget_tokens: 2000,
          }
        : {
            type: 'disabled',
          },
    };

    console.log('发送请求到豆包API:', {
      model: this.model,
      messageCount: formattedMessages.length,
      useDeepThinking: options?.useDeepThinking,
    });

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
      console.error('API错误详情:', errorText);
      throw new Error(`豆包 API 错误: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('响应体为空，无法进行流式处理');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

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
              if (dataStr.trim() && dataStr.trim() !== '[DONE]') {
                console.warn('无法解析的流数据:', dataStr.substring(0, 100));
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *streamRaw(
    messages: any[],
    options?: DoubaoCallOptions,
  ): AsyncGenerator<StreamChunk> {
    yield* this._streamResponse(messages, { ...options, stream: true });
  }

  async invoke(messages: any[], options?: DoubaoCallOptions): Promise<any> {
    const baseMessages = this.convertToBaseMessages(messages);

    let fullContent = '';
    for await (const chunk of this._streamResponse(baseMessages, options)) {
      if (chunk.type === 'content') {
        fullContent += chunk.content;
      }
    }

    return {
      content: fullContent,
    };
  }

  async stream(
    input: any[] | string,
    options?: DoubaoCallOptions,
  ): Promise<IterableReadableStream<AIMessageChunk>> {
    const messages = Array.isArray(input)
      ? this.convertToBaseMessages(input)
      : [new HumanMessage(input)];

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
}
