import type React from 'react';
import MessageItem from './MessageItem';
import styles from './MessageList.module.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  thinking?: string;
  isStreaming?: boolean;
  currentStreamText?: string;
}

interface MessageListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  messagesEndRef,
}) => {
  // 欢迎界面
  if (messages.length === 0) {
    return (
      <div className={styles.welcomeTitle}>
        <span className={styles.blackText}>你好，欢迎使用</span>
        <div className={styles.gradientIconMask} />
        <span className={styles.gradientText}>任务助手</span>
      </div>
    );
  }

  return (
    <div className={styles.messagesListContainer}>
      <div className={styles.messagesList}>
        {messages.map(message => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
};

export default MessageList;
