import type React from 'react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  onToggleTheme: () => void;
  isDarkMode: boolean;
  messageCount: number;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleTheme,
  isDarkMode,
  messageCount,
}) => {
  return (
    <div className={styles.headerContainer}>
      <h1 className={styles.title}>任务助手</h1>
      <div className={styles.headerActions}>
        <span className={styles.messageCount}>{messageCount} 条消息</span>
        <button
          type="button"
          className={`${styles.themeToggle} ${isDarkMode ? styles.dark : styles.light}`}
          onClick={onToggleTheme}
          title={isDarkMode ? '切换到亮色模式' : '切换到暗黑模式'}
          aria-label={isDarkMode ? '切换到亮色模式' : '切换到暗黑模式'}
        >
          <span className={styles.themeIcon}>{isDarkMode ? '☀️' : '🌙'}</span>
          <span className={styles.themeText}>
            {isDarkMode ? '亮色模式' : '暗黑模式'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
