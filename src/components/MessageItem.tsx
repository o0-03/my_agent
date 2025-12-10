import type React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Message, TodoListData } from '../types';
import styles from './MessageItem.module.css';
import TodoList from './TodoList';
import SearchResultsVisual from './SearchResultsVisual';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  // 格式化时间
  const formatTime = (dateInput: Date | string | number) => {
    let date: Date;

    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = new Date();
    }

    if (Number.isNaN(date.getTime())) {
      return '--:--';
    }

    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化时长
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // 获取时间戳
  const getTimestamp = () => {
    if (message.timestamp instanceof Date) {
      return message.timestamp;
    }
    if (
      typeof message.timestamp === 'string' ||
      typeof message.timestamp === 'number'
    ) {
      return message.timestamp;
    }
    return new Date();
  };

  // 检查是否有搜索信息
  const showSearchInfo = message.searchInfo && message.role === 'assistant';
  const showThinking = message.role === 'assistant' && message.thinking;
  const hasSearchResults =
    message.searchResults && message.searchResults.length > 0;

  // 检查是否有TODO数据
  const hasTodoData =
    message.todoData &&
    message.todoData.type === 'todo_list' &&
    Array.isArray(message.todoData.items) &&
    message.todoData.items.length > 0;

  // 渲染内容
  const renderContent = () => {
    const contentToRender =
      message.isStreaming && message.currentStreamText !== undefined
        ? message.currentStreamText
        : message.content;
    // console.log('Rendering content:', contentToRender);
    return (
      <>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
          {contentToRender}
        </ReactMarkdown>
        {message.isStreaming && (
          <span className={styles.typewriterCursor}>|</span>
        )}
      </>
    );
  };

  return (
    <div
      className={`${styles.messageRow} ${
        message.role === 'user' ? styles.userRow : styles.assistantRow
      }`}
    >
      <div className={styles.messageBubbleWrapper}>
        <div
          className={`${styles.messageBubble} ${
            message.role === 'user' ? styles.userBubble : styles.assistantBubble
          }`}
        >
          {/* 联网搜索信息 */}
          {showSearchInfo && (
            <div className={styles.searchContainer}>
              <div className={styles.searchHeader}>
                <span className={styles.searchIcon}>🔍</span>
                <span className={styles.searchTitle}>联网搜索</span>
                {message.searchTime && (
                  <span className={styles.searchTime}>
                    ({formatDuration(message.searchTime)})
                  </span>
                )}
              </div>
              <div className={styles.searchText}>{message.searchInfo}</div>

              {/* 搜索结果列表 */}
              {hasSearchResults && (
                <div className={styles.searchResults}>
                  <SearchResultsVisual
                    results={message.searchResults ?? []}
                    searchTime={message.searchTime}
                  />
                </div>
              )}
            </div>
          )}

          {/* 深度思考 */}
          {showThinking && (
            <div className={styles.thinkingContainer}>
              <div className={styles.thinkingHeader}>
                <span className={styles.thinkingIcon}>🧠</span>
                <span className={styles.thinkingTitle}>深度思考</span>
                {message.thinkingTime && (
                  <span className={styles.thinkingTime}>
                    ({formatDuration(message.thinkingTime)})
                  </span>
                )}
              </div>
              <div className={styles.thinkingText}>{message.thinking}</div>
            </div>
          )}

          {/* 消息内容 */}
          <div className={styles.messageContentInner}>
            <div className={styles.messageText}>{renderContent()}</div>

            {/* TODO列表 */}
            {hasTodoData && (
              <div className={styles.todoSection}>
                <div className={styles.todoHeader}>
                  <span className={styles.todoIcon}>📋</span>
                  <span className={styles.todoTitle}>
                    {message.todoData?.title}
                  </span>
                </div>
                <TodoList data={message.todoData as TodoListData} />
              </div>
            )}

            {/* 时间戳 */}
            <div className={styles.messageTimestamp}>
              {formatTime(getTimestamp())}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
