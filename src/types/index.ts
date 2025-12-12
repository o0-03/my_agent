export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
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
  type: 'thinking' | 'content' | 'search' | 'metadata' | 'tododata' | 'error';
  content: string;
  searchResults?: SearchResultItem[];
  searchTime?: number;
  conversationId?: string;
  isLocal?: boolean;
  messageCount?: number;
  todoData?: TodoListData;
}

export interface SearchResult {
  success: boolean;
  content: string;
  results?: SearchResultItem[];
  sources?: string[];
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentInput {
  input: string;
  useWebSearch?: boolean;
  useDeepThinking?: boolean;
  conversationId?: string;
  history?: HistoryMessage[];
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
  history?: HistoryMessage[];
  useWebSearch?: boolean;
  useDeepThinking?: boolean;
  conversationId?: string;
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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

export type ToolType = 'search' | 'todo' | 'goal' | 'none';

export interface ToolExecutionContext {
  userInput: string;
  searchContent: string;
  thinkingContent: string;
  history: HistoryMessage[];
  searchResults?: SearchResultItem[];
}

export interface ToolExecutionResult {
  response: string;
  data?: unknown;
  toolType: ToolType;
}
