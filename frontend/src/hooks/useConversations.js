import { useState, useEffect, useCallback } from 'react';
import {
  deleteConversation as apiDeleteConversation,
  getConversations,
  renameConversation as apiRenameConversation,
} from '../services/api';
import { generateId } from '../utils/helpers';

export function useConversations({ isAuthenticated = false } = {}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const error = null;

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

  const loadFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (e) {
      console.error('Failed to load conversations from server:', e);
      setConversations([]);
    } finally {
      setLoading(false);
    }
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
      title: 'New Chat',
      last_message: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setConversations(prev => {
      const updated = [newConv, ...prev];
      if (!isAuthenticated) saveToStorage(updated);
      return updated;
    });
    return newConv;
  }, [isAuthenticated, saveToStorage]);

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
      if (!isAuthenticated) saveToStorage(updated);
      return updated;
    });
  }, [isAuthenticated, saveToStorage]);

  // 删除对话
  const deleteConversation = useCallback(async (id) => {
    if (isAuthenticated) {
      await apiDeleteConversation(id);
      setConversations(prev => prev.filter(conv => conv.id !== id));
      return;
    }

    setConversations(prev => {
      const updated = prev.filter(conv => conv.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [isAuthenticated, saveToStorage]);

  // 重命名对话（本地乐观更新 + 后端同步）
  const renameConversation = useCallback(async (id, title) => {
    const trimmed = (title || '').trim().slice(0, 50);
    if (!trimmed) throw new Error('Title cannot be empty');

    if (isAuthenticated) {
      const result = await apiRenameConversation(id, trimmed);
      setConversations(prev => prev.map(conv => (
        conv.id === id ? { ...conv, title: result.title || trimmed } : conv
      )));
      return;
    }

    setConversations(prev => {
      const updated = prev.map(conv =>
        conv.id === id ? { ...conv, title: trimmed } : conv
      );
      saveToStorage(updated);
      return updated;
    });

  }, [isAuthenticated, saveToStorage]);

  // 获取单个对话
  const getConversation = useCallback((id) => {
    return conversations.find(conv => conv.id === id);
  }, [conversations]);

  // 初始化
  useEffect(() => {
    if (isAuthenticated) loadFromServer();
    else loadFromStorage();
  }, [isAuthenticated, loadFromServer, loadFromStorage]);

  return {
    conversations,
    loading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    renameConversation,
    getConversation,
    refresh: isAuthenticated ? loadFromServer : loadFromStorage,
  };
}
