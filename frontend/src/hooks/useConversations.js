import { useState, useEffect, useCallback } from 'react';
import { deleteConversation as apiDeleteConversation } from '../services/api';
import { generateId } from '../utils/helpers';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 从 localStorage 加载对话
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('sagemro_conversations');
      if (stored) {
        setConversations(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load conversations from storage:', e);
    }
    setLoading(false);
  }, []);

  // 保存到 localStorage
  const saveToStorage = useCallback((convs) => {
    try {
      localStorage.setItem('sagemro_conversations', JSON.stringify(convs));
    } catch (e) {
      console.error('Failed to save conversations to storage:', e);
    }
  }, []);

  // 创建新对话
  const createConversation = useCallback(() => {
    const newConv = {
      id: generateId(),
      title: '新对话',
      last_message: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setConversations(prev => {
      const updated = [newConv, ...prev];
      saveToStorage(updated);
      return updated;
    });
    return newConv;
  }, [saveToStorage]);

  // 更新对话
  const updateConversation = useCallback((id, updates) => {
    setConversations(prev => {
      const updated = prev.map(conv =>
        conv.id === id
          ? { ...conv, ...updates, updated_at: new Date().toISOString() }
          : conv
      );
      // 按 updated_at 排序
      updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 删除对话
  const deleteConversation = useCallback(async (id) => {
    try {
      await apiDeleteConversation(id);
    } catch (e) {
      // 即使 API 失败，也删除本地记录
    }
    setConversations(prev => {
      const updated = prev.filter(conv => conv.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 获取单个对话
  const getConversation = useCallback((id) => {
    return conversations.find(conv => conv.id === id);
  }, [conversations]);

  // 初始化
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return {
    conversations,
    loading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    getConversation,
    refresh: loadFromStorage,
  };
}
