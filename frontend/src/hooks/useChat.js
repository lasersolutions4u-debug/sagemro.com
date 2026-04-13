import { useState, useRef, useCallback } from 'react';
import { streamChat } from '../services/api';

// 生成唯一 ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // 发送消息
  const sendMessage = useCallback(async (content) => {
    // C类用户（未登录）限制10次对话
    const isLoggedIn = localStorage.getItem('sagemro_customer_id') || localStorage.getItem('sagemro_engineer_id');
    if (!isLoggedIn) {
      const count = parseInt(localStorage.getItem('guest_conversation_count') || '0', 10);
      if (count >= 10) {
        setError('您的好奇心已用完，请注册账号继续体验。');
        return;
      }
      localStorage.setItem('guest_conversation_count', String(count + 1));
    }

    // 创建用户消息
    const userMessage = {
      id: generateId(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    // 添加用户消息到列表
    setMessages(prev => [...prev, userMessage]);

    // 创建空的 assistant 消息占位
    const assistantMessageId = generateId();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }]);

    // 设置流式状态
    setIsStreaming(true);
    setError(null);

    // 创建 AbortController
    abortControllerRef.current = new AbortController();

    // 构建历史消息（最近 10 轮）
    const historyMessages = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 收集 AI 回复
    let aiContent = '';

    await new Promise((resolve) => {
      streamChat({
        conversationId,
        message: content,
        onChunk: (data) => {
          if (data.content) {
            aiContent += data.content;
            // 更新 assistant 消息
            setMessages(prev => prev.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: aiContent }
                : m
            ));
          }
          if (data.conversation_id && !conversationId) {
            setConversationId(data.conversation_id);
          }
        },
        onDone: () => {
          setIsStreaming(false);
          resolve();
        },
        onError: (err) => {
          setError(err.message);
          setIsStreaming(false);
          resolve();
        },
        signal: abortControllerRef.current.signal,
      });
    });
  }, [conversationId, messages]);

  // 停止生成
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  // 加载历史消息
  const loadMessages = useCallback((historyMessages, convId) => {
    setMessages(historyMessages.map(m => ({
      ...m,
      id: m.id || generateId(),
    })));
    setConversationId(convId);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    conversationId,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
  };
}
