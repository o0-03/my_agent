import type React from 'react';
import { useState, useEffect } from 'react';
import type { Conversation } from '../types';
import styles from './ConversationSidebar.module.css';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  onCreateConversation: () => Promise<void>;
  onSwitchConversation: (conversationId: string) => Promise<void>;
  onDeleteConversation?: (conversationId: string) => Promise<void>;
  onArchiveConversation?: (conversationId: string) => Promise<void>;
}

const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  currentConversationId,
  isLoading,
  onCreateConversation,
  onSwitchConversation,
  onDeleteConversation,
  onArchiveConversation,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState('');

  // 过滤对话列表
  const filteredConversations = conversations.filter(
    conv =>
      conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.messages.some(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  // 格式化时间显示
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

    return new Date(date).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  // 处理删除确认
  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(conversationId);
  };

  const handleDeleteConfirm = async (conversationId: string) => {
    if (onDeleteConversation) await onDeleteConversation(conversationId);
    setShowDeleteConfirm(null);
  };

  // 处理归档
  const handleArchiveClick = async (
    e: React.MouseEvent,
    conversationId: string,
  ) => {
    e.stopPropagation();
    if (onArchiveConversation) await onArchiveConversation(conversationId);
  };

  // 获取最后一条消息的预览
  const getLastMessagePreview = (conversation: Conversation) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return '暂无消息';

    const content = lastMessage.content;
    return content.length > 30 ? `${content.substring(0, 30)}...` : content;
  };

  // 侧边栏收起状态
  if (isCollapsed) {
    return (
      <div className={styles['sidebar-collapsed']}>
        <button
          type="button"
          className={styles['sidebar-toggle']}
          onClick={() => setIsCollapsed(false)}
          title="展开侧边栏"
        >
          ▶
        </button>
        <button
          type="button"
          className={styles['new-chat-btn-collapsed']}
          onClick={onCreateConversation}
          title="新对话"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className={styles['conversation-sidebar']}>
      {/* 侧边栏头部 */}
      <div className={styles['sidebar-header']}>
        <div className={styles['sidebar-header-title']}>
          <h3>对话历史</h3>
          <span className={styles['conversation-count']}>
            {conversations.length}个对话
          </span>
        </div>
        <div className={styles['sidebar-header-actions']}>
          <button
            type="button"
            className={styles['sidebar-toggle']}
            onClick={() => setIsCollapsed(true)}
            title="收起侧边栏"
          >
            ◀
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className={styles['sidebar-search']}>
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={styles['search-input']}
        />
        {searchTerm && (
          <button
            type="button"
            className={styles['clear-search']}
            onClick={() => setSearchTerm('')}
            title="清除搜索"
          >
            ✕
          </button>
        )}
      </div>

      {/* 新建对话按钮 */}
      <div className={styles['new-conversation-section']}>
        <button
          type="button"
          className={styles['new-conversation-btn']}
          onClick={onCreateConversation}
          disabled={isLoading}
        >
          <span className={styles['btn-icon']}>+</span>
          <span className={styles['btn-text']}>新对话</span>
        </button>
      </div>

      {/* 对话列表 */}
      <div className={styles['conversation-list']}>
        {isLoading ? (
          <div className={styles['loading-indicator']}>
            <div className={styles['loading-spinner']} />
            <span>加载中...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className={styles['empty-state']}>
            {searchTerm ? (
              <>
                <div className={styles['empty-icon']}>🔍</div>
                <p>未找到相关对话</p>
                <button
                  type="button"
                  className={styles['clear-search-btn']}
                  onClick={() => setSearchTerm('')}
                >
                  清除搜索
                </button>
              </>
            ) : (
              <>
                <div className={styles['empty-icon']}>💬</div>
                <p>暂无对话历史</p>
                <p className={styles['empty-hint']}>开始一个新的对话吧</p>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map(conversation => (
            <div
              key={conversation.id}
              className={`${styles['conversation-item']} ${
                currentConversationId === conversation.id ? styles.active : ''
              }`}
            >
              <button
                type="button"
                className={styles['conversation-item-main-button']}
                onClick={() => onSwitchConversation(conversation.id)}
                aria-label={`切换到对话：${conversation.title}`}
              >
                <div className={styles['conversation-item-main']}>
                  <div className={styles['conversation-title-row']}>
                    <span className={styles['conversation-title']}>
                      {conversation.title}
                    </span>
                    {conversation.isArchived && (
                      <span className={styles['archived-badge']}>已归档</span>
                    )}
                  </div>

                  <div className={styles['conversation-preview']}>
                    {getLastMessagePreview(conversation)}
                  </div>

                  <div className={styles['conversation-meta']}>
                    <span className={styles['message-count']}>
                      {conversation.messages.length}条消息
                    </span>
                    <span className={styles['conversation-date']}>
                      {formatTime(conversation.updatedAt)}
                    </span>
                  </div>
                </div>
              </button>

              <div className={styles['conversation-actions']}>
                {onArchiveConversation && !conversation.isArchived && (
                  <button
                    type="button"
                    className={`${styles['action-btn']} ${styles['archive-btn']}`}
                    onClick={e => handleArchiveClick(e, conversation.id)}
                    title="归档对话"
                  >
                    📁
                  </button>
                )}

                {onDeleteConversation && (
                  <button
                    type="button"
                    className={`${styles['action-btn']} ${styles['delete-btn']}`}
                    onClick={e => handleDeleteClick(e, conversation.id)}
                    title="删除对话"
                  >
                    {showDeleteConfirm === conversation.id ? '确认？' : '🗑️'}
                  </button>
                )}

                {showDeleteConfirm === conversation.id && (
                  <div className={styles['delete-confirm-overlay']}>
                    <div className={styles['delete-confirm-box']}>
                      <p>删除此对话？</p>
                      <div className={styles['delete-confirm-actions']}>
                        <button
                          type="button"
                          className={styles['confirm-btn']}
                          onClick={() => handleDeleteConfirm(conversation.id)}
                        >
                          确认
                        </button>
                        <button
                          type="button"
                          className={styles['cancel-btn']}
                          onClick={() => setShowDeleteConfirm(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部信息 */}
      <div className={styles['sidebar-footer']}>
        <div className={styles['storage-info']}>
          <span className={styles['storage-icon']}>💾</span>
          <span>数据已同步</span>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebar;
