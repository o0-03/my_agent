// 首先定义 SearchResultItem，因为它被其他类型引用
export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  thinking?: string;
  isStreaming?: boolean;
  currentStreamText?: string;
  thinkingTime?: number;
  searchInfo?: string;
  searchTime?: number;
  searchResults?: SearchResultItem[];
  todoData?: TodoListData;
}

export interface StreamChunk {
  type: 'thinking' | 'content' | 'search' | 'metadata' | 'tododata';
  content: string;
  searchResults?: SearchResultItem[];
  searchTime?: number;
  conversationId?: string;
  isLocal?: boolean;
  messageCount?: number;
  todoData?: TodoListData;
}

export interface SearchResult {
  content: string;
  sources?: string[];
  results?: SearchResultItem[];
}

export interface AgentInput {
  input: string;
  useWebSearch?: boolean;
  useDeepThinking?: boolean;
  context?: any[];
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
}

export interface PushData {
  type: 'thinking' | 'content' | 'error' | 'search' | 'metadata' | 'tododata';
  content: string;
  searchResults?: SearchResultItem[];
  searchTime?: number;
  conversationId?: string;
  isLocal?: boolean;
  messageCount?: number;
  todoData?: TodoListData;
}

export interface RequestData {
  message: string;
  history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  useWebSearch?: boolean;
  useDeepThinking?: boolean;
  conversationId?: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  context?: any[];
}

export interface Conversation {
  _id?: string;
  id: string;
  title: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

export interface ConversationList {
  conversations: Conversation[];
  currentConversationId: string | null;
}

export interface CreateConversationData {
  title?: string;
  initialMessage?: string;
}

export interface UpdateConversationData {
  title?: string;
  messages?: Message[];
}

export interface DoubaoCallOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  useDeepThinking?: boolean;
}

export interface DoubaoLangChainOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConversationUpdateRequest {
  title?: string;
  isArchived?: boolean;
}

export interface ConversationMessageRequest {
  message: Message;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  ip?: string;
  userAgent?: string;
  lastActive?: Date;
}

export interface AppConfig {
  mongoDbUri: string;
  volcengineApiKey: string;
  tavilyApiKey: string;
  sessionSecret: string;
}

export interface StreamHandlerOptions {
  encoder: TextEncoder;
  controller: ReadableStreamDefaultController;
  push: (obj: PushData) => void;
}

export interface ConversationServiceFunctions {
  getConversation: (
    userId: string,
    conversationId: string,
  ) => Promise<Conversation | null>;
  createConversation: (
    userId: string,
    data: CreateConversationData,
  ) => Promise<Conversation>;
  addMessage: (
    userId: string,
    conversationId: string,
    message: Message,
  ) => Promise<Conversation | null>;
  updateTitle: (
    userId: string,
    conversationId: string,
    title: string,
  ) => Promise<Conversation | null>;
  archiveConversation: (
    userId: string,
    conversationId: string,
  ) => Promise<boolean>;
  deleteConversation: (
    userId: string,
    conversationId: string,
  ) => Promise<boolean>;
}

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  details?: any;
}

export interface SSEEvent {
  event?: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  data: any;
  id?: string;
  retry?: number;
}

export interface TodoItem {
  id: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  estimated_time: number;
  category: string;
  completed?: boolean;
}

export interface TodoListData {
  type: 'todo_list';
  title: string;
  items: TodoItem[];
}
