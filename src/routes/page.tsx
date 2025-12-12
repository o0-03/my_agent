import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import './index.css';
import ChatHeader from '../components/ChatHeader';
import ChatInput from '../components/ChatInput';
import ConversationSidebar from '../components/ConversationSidebar';
import MessageList from '../components/MessageList';
import type { Conversation, Message, SearchResultItem } from '../types';

const loadDatabaseConversation = async (
  conversationId: string,
): Promise<Message[]> => {
  try {
    const response = await fetch(`/api/conversations?id=${conversationId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'API返回失败');

    let conversationMessages: Message[] = [];
    if (data.data?.currentConversation?.messages) {
      conversationMessages = data.data.currentConversation.messages;
    } else if (data.data?.messages) {
      conversationMessages = data.data.messages;
    } else if (data.data) {
      conversationMessages = data.data.messages || [];
    }

    return conversationMessages.map(item => {
      const message: Message = {
        id: String(item.id),
        content: String(item.content),
        role: String(item.role) as 'user' | 'assistant',
        timestamp: new Date(String(item.timestamp)),
        thinking: item.thinking as string | undefined,
        thinkingTime: item.thinkingTime as number | undefined,
        searchInfo: item.searchInfo as string | undefined,
        searchResults: item.searchResults as SearchResultItem[] | undefined,
        searchTime: item.searchTime as number | undefined,
        todoData: item.todoData as Message['todoData'],
        isStreaming: false,
        currentStreamText: undefined,
      };
      return message;
    });
  } catch (error) {
    console.error('加载数据库对话失败:', error);
    return [];
  }
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return (
      savedTheme === 'dark' ||
      (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalConversations, setTotalConversations] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'archived'>('all');

  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && shouldAutoScroll) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [shouldAutoScroll]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceFromBottom <= 100;

      if (!atBottom && shouldAutoScroll) {
        setShouldAutoScroll(false);
      }
    };

    const debouncedHandleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleScroll, 100);
    };

    container.addEventListener('scroll', debouncedHandleScroll);
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(scrollTimer);
    };
  }, [shouldAutoScroll]);

  const loadConversations = useCallback(
    async (page = 1, loadMore = false) => {
      console.log('loadConversations called', {
        page,
        loadMore,
        searchTerm,
        activeTab,
      });

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingConversations(true);
        if (page === 1) {
          setCurrentPage(1);
        }
      }

      try {
        let apiUrl = `/api/conversations?page=${page}&pageSize=20`;

        if (searchTerm) {
          apiUrl += `&search=${encodeURIComponent(searchTerm)}`;
        }
        if (activeTab === 'archived') {
          apiUrl += '&archived=true';
        }

        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const apiConversations = data.data?.conversations || [];
            const total = data.data?.total || 0;
            const hasMoreData = data.data?.hasMore || false;

            if (loadMore) {
              setConversations(prev => {
                const existingIds = new Set(prev.map(c => c.id));
                const newConversations = apiConversations.filter(
                  (c: { id: string }) => !existingIds.has(c.id),
                );
                return [...prev, ...newConversations];
              });
              setCurrentPage(page);
            } else {
              setConversations(apiConversations);
            }

            setTotalConversations(total);
            setHasMore(hasMoreData);

            const conversationId = data.data?.currentConversationId;
            if (conversationId) {
              const conversationMessages =
                await loadDatabaseConversation(conversationId);
              const sortedMessages = conversationMessages.sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
              );
              setMessages(sortedMessages);
              setCurrentConversationId(conversationId);
            } else {
              setMessages([]);
              setCurrentConversationId(null);
            }
          } else {
            console.error('API返回失败:', data.error);
            setConversations([]);
            setMessages([]);
          }
        } else {
          console.error('HTTP请求失败:', response.status);
          setConversations([]);
          setMessages([]);
        }
      } catch (error) {
        console.error('加载对话列表失败:', error);
        setConversations([]);
        setMessages([]);
      } finally {
        setIsLoadingConversations(false);
        setIsLoadingMore(false);
      }
    },
    [searchTerm, activeTab],
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoadingConversations) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      await loadConversations(nextPage, true);
    } catch (error) {
      console.error('加载更多对话失败:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isLoadingMore,
    isLoadingConversations,
    currentPage,
    loadConversations,
  ]);

  const createNewConversation = async (
    initialMessage?: string,
  ): Promise<string> => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${initialMessage?.substring(0, 20)}...` || '新对话',
          initialMessage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.id;
        }
      }
      throw new Error('创建对话失败');
    } catch (error) {
      console.error('创建对话失败:', error);
      throw error;
    }
  };

  const handleSwitchConversation = async (conversationId: string) => {
    if (currentConversationId === conversationId) return;

    try {
      const conversationMessages =
        await loadDatabaseConversation(conversationId);
      const sortedMessages = conversationMessages.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      setMessages(sortedMessages);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('切换对话失败:', error);
      setMessages([]);
    }

    setTimeout(scrollToBottom, 100);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm('确定要删除这个对话吗？')) return;

    try {
      const response = await fetch(`/api/conversations?id=${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadConversations(1, false);
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
      } else {
        console.error('删除对话失败');
      }
    } catch (error) {
      console.error('删除对话失败:', error);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!window.confirm('确定要归档这个对话吗？')) return;
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/archive`,
        {
          method: 'POST',
        },
      );

      if (response.ok) {
        await loadConversations(1, false);

        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('归档对话失败:', error);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const conversationId = await createNewConversation();
      setCurrentConversationId(conversationId);
      setMessages([]);
      await loadConversations(1, false);
    } catch (error) {
      console.error('创建对话失败:', error);
    }
  };

  const connectToSSE = async (
    userInput: string,
    messageId: string,
    conversationId: string,
    currentMessages: Message[],
  ) => {
    try {
      const requestData = {
        message: userInput,
        conversationId,
        history: currentMessages
          .filter(msg => msg.id !== messageId)
          .slice(-6)
          .map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        useDeepThinking,
        useWebSearch,
      };

      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      if (!response.body) throw new Error('响应体不可读');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let thinkingContent = '';
      let contentText = '';
      let searchInfo = '';
      let searchResults: SearchResultItem[] = [];
      let searchTime = 0;
      let buffer = '';
      let thinkingStartTime = 0;
      let thinkingEndTime = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            setMessages(prevMessages => {
              return prevMessages.map(msg =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: contentText,
                      thinking: thinkingContent,
                      thinkingTime: thinkingEndTime - thinkingStartTime,
                      searchInfo,
                      searchResults,
                      searchTime,
                      isStreaming: false,
                      currentStreamText: undefined,
                    }
                  : msg,
              );
            });

            setLoading(false);
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const dataStr = trimmedLine.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;

              if (data.type === 'thinking') {
                if (!thinkingStartTime) thinkingStartTime = Date.now();
                thinkingContent += String(data.content || '');
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === messageId
                      ? { ...msg, thinking: thinkingContent, isStreaming: true }
                      : msg,
                  ),
                );
              } else if (data.type === 'content') {
                if (!thinkingEndTime && thinkingStartTime)
                  thinkingEndTime = Date.now();
                contentText += String(data.content || '');
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          content: contentText,
                          currentStreamText: contentText,
                          isStreaming: true,
                        }
                      : msg,
                  ),
                );
              } else if (data.type === 'search') {
                searchInfo = String(data.content || '');
                searchResults =
                  (data.searchResults as SearchResultItem[]) || [];
                searchTime = Number(data.searchTime) || 0;
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          searchInfo,
                          searchResults,
                          searchTime,
                          isStreaming: true,
                        }
                      : msg,
                  ),
                );
              } else if (data.type === 'tododata') {
                if (data.content) contentText += String(data.content);
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === messageId
                      ? {
                          ...msg,
                          content: contentText,
                          todoData: data.todoData as Message['todoData'],
                          isStreaming: true,
                          currentStreamText: contentText,
                        }
                      : msg,
                  ),
                );
              }

              requestAnimationFrame(scrollToBottom);
            } catch (e) {
              console.error('解析JSON失败:', e, '原始数据:', dataStr);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('SSE连接错误:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                content: `错误: ${errorMessage}`,
                isStreaming: false,
                currentStreamText: undefined,
              }
            : msg,
        ),
      );
      setLoading(false);
    }
  };

  const handleSend = async (content: string) => {
    if (!content.trim() || loading) return;
    setLoading(true);

    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        conversationId = await createNewConversation(content);
        setCurrentConversationId(conversationId);
      } catch (error) {
        console.error('创建对话失败:', error);
        setLoading(false);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true,
      currentStreamText: '',
    };

    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);

    setTimeout(() => {
      if (conversationId) {
        connectToSSE(content, assistantMessage.id, conversationId, newMessages);
      } else {
        console.error('conversationId is null');
        setLoading(false);
      }
    }, 0);
  };

  const toggleDeepThinking = () => setUseDeepThinking(!useDeepThinking);
  const toggleWebSearch = () => setUseWebSearch(!useWebSearch);

  useEffect(() => {
    loadConversations(1, false);
  }, []);

  return (
    <div className="chat-container">
      <ChatHeader
        onToggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        messageCount={messages.length}
      />

      <div className="main-content">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          isLoading={isLoadingConversations}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          totalConversations={totalConversations}
          onLoadMore={handleLoadMore}
          onCreateConversation={handleCreateConversation}
          onSwitchConversation={handleSwitchConversation}
          onDeleteConversation={handleDeleteConversation}
          onArchiveConversation={handleArchiveConversation}
        />

        <div className="chat-main">
          <div className="scroll-container" ref={scrollContainerRef}>
            <div className="messages-container">
              <MessageList
                messages={messages}
                messagesEndRef={messagesEndRef}
              />
              <div className="input-spacer" ref={messagesEndRef} />
            </div>
          </div>

          <div className="chat-input">
            <ChatInput
              onSend={handleSend}
              loading={loading}
              useDeepThinking={useDeepThinking}
              onToggleDeepThinking={toggleDeepThinking}
              useWebSearch={useWebSearch}
              onToggleWebSearch={toggleWebSearch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
