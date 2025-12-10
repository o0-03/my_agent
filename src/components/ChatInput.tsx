import type React from 'react';
import { useState } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  useDeepThinking: boolean;
  onToggleDeepThinking: () => void;
  useWebSearch: boolean;
  onToggleWebSearch: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  loading,
  useDeepThinking,
  onToggleDeepThinking,
  useWebSearch,
  onToggleWebSearch,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim() || loading) return;
    onSend(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputWrapper}>
        <textarea
          name="messageInput"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="输入你的问题..."
          className={styles.messageInput}
          disabled={loading}
          rows={3}
        />

        <div className={styles.controlsRow}>
          {/* 控制开关组 */}
          <div className={styles.switchGroup}>
            {/* 深度思考开关 */}
            <label className={styles.deepThinkingSwitch}>
              <input
                type="checkbox"
                checked={useDeepThinking}
                onChange={onToggleDeepThinking}
                disabled={loading}
              />
              <span className={styles.slider} />
              <span className={styles.switchLabel}>深度思考</span>
            </label>

            {/* 联网搜索开关 */}
            <label className={styles.webSearchSwitch}>
              <input
                type="checkbox"
                checked={useWebSearch}
                onChange={onToggleWebSearch}
                disabled={loading}
              />
              <span className={styles.slider} />
              <span className={styles.switchLabel}>联网搜索</span>
            </label>
          </div>

          <div className={styles.actionButtons}>
            <button type="button" className={styles.addButton}>
              <span className={styles.addIcon}>+</span>
            </button>

            <button
              type="button"
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
            >
              {loading ? (
                <div className={styles.loadingSpinner} />
              ) : (
                <svg
                  className={styles.sendIcon}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-labelledby="sendIconTitle"
                >
                  <title id="sendIconTitle">Send message</title>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
