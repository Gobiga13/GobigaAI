/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, Plus, Sparkles, MessageSquare, Menu, X, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { ai, DEFAULT_MODEL } from './lib/gemini';
import { cn } from './lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('gemini_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const messages = activeChat?.messages || [];

  useEffect(() => {
    localStorage.setItem('gemini_chats', JSON.stringify(chats));
  }, [chats]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this chat?')) {
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    }
  };

  const startRenaming = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle.trim() } : c));
    }
    setEditingChatId(null);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    let currentChatId = activeChatId;
    let currentChats = [...chats];

    // Create a new chat if none is active
    if (!currentChatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: input.trim().slice(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      currentChats = [newChat, ...currentChats];
      setChats(currentChats);
      currentChatId = newChat.id;
      setActiveChatId(newChat.id);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const updatedChats = currentChats.map(chat => {
      if (chat.id === currentChatId) {
        const newMessages = [...chat.messages, userMessage];
        // Update title if it's the first message
        const newTitle = chat.messages.length === 0 
          ? userMessage.content.slice(0, 30) + (userMessage.content.length > 30 ? '...' : '')
          : chat.title;
        return { ...chat, messages: newMessages, title: newTitle, updatedAt: Date.now() };
      }
      return chat;
    });

    setChats(updatedChats);
    setInput('');
    setIsLoading(true);

    try {
      const chatToUpdate = updatedChats.find(c => c.id === currentChatId);
      if (!chatToUpdate) return;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: chatToUpdate.messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Sorry, I couldn\'t generate a response.',
        timestamp: Date.now(),
      };

      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return { ...chat, messages: [...chat.messages, assistantMessage], updatedAt: Date.now() };
        }
        return chat;
      }));
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error: Failed to connect to the AI service. Please check your API key and connection.',
        timestamp: Date.now(),
      };
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return { ...chat, messages: [...chat.messages, errorMessage], updatedAt: Date.now() };
        }
        return chat;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 font-sans overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative z-30 h-full bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out flex flex-col",
        isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0"
      )}>
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full p-3 mb-6 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>New Chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
            <h3 className="px-2 mb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">History</h3>
            {chats.length === 0 ? (
              <p className="px-2 py-4 text-xs text-zinc-400 italic">No chats yet</p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    if (editingChatId === chat.id) return;
                    setActiveChatId(chat.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "group relative flex flex-col w-full p-3 rounded-xl transition-all cursor-pointer",
                    activeChatId === chat.id 
                      ? "bg-zinc-100 text-zinc-900" 
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                      {editingChatId === chat.id ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(chat.id);
                            if (e.key === 'Escape') setEditingChatId(null);
                          }}
                          onBlur={() => saveRename(chat.id)}
                          className="text-sm bg-white border border-zinc-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm truncate font-medium">{chat.title}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {editingChatId === chat.id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveRename(chat.id);
                          }}
                          className="p-1 hover:text-green-600"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => startRenaming(chat, e)}
                            className="p-1 hover:text-zinc-900"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="p-1 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1 ml-7">
                    <span className="text-[10px] text-zinc-400">
                      {formatTime(chat.updatedAt || chat.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100">
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-zinc-900 truncate">Guest User</p>
                <p className="text-[10px] text-zinc-400 truncate">Free Plan</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-semibold text-zinc-900 tracking-tight hidden sm:block">Gobiga AI Chat</h1>
            </div>
          </div>
          
          {activeChatId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium px-2 py-1 bg-zinc-100 rounded-full">
                {activeChat?.title}
              </span>
            </div>
          )}
        </header>

        {/* Chat Area */}
        <main 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-8 md:px-0 scroll-smooth"
        >
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-zinc-400" />
                </div>
                <h2 className="text-2xl font-semibold text-zinc-900">How can I help you today?</h2>
                <p className="text-zinc-500 max-w-md">
                  Start a conversation with Gobiga AI. You can ask questions, get help with code, or just chat.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-lg">
                  {[
                    "Explain quantum physics like I'm five",
                    "Write a poem about a rainy day",
                    "Help me debug a React useEffect loop",
                    "Suggest some healthy dinner ideas"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="p-4 text-left text-sm text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-4 group",
                      message.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                      message.role === 'user' ? "bg-zinc-900" : "bg-zinc-100 border border-zinc-200"
                    )}>
                      {message.role === 'user' ? (
                        <User className="w-5 h-5 text-white" />
                      ) : (
                        <Bot className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                      message.role === 'user' 
                        ? "bg-zinc-900 text-white" 
                        : "bg-white border border-zinc-200 text-zinc-900"
                    )}>
                      <div className="markdown-body">
                        <Markdown>{message.content}</Markdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {isLoading && (
              <div className="flex gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  <span className="text-sm text-zinc-400">Gobiga AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <footer className="p-4 md:p-6 bg-white border-t border-zinc-200">
          <div className="max-w-3xl mx-auto relative">
            <form 
              onSubmit={handleSend}
              className="relative flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl shadow-sm focus-within:border-zinc-900 focus-within:bg-white focus-within:ring-1 focus-within:ring-zinc-900 transition-all p-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message Gobiga AI..."
                className="flex-1 max-h-48 min-h-[44px] p-2 bg-transparent border-none focus:ring-0 resize-none text-zinc-900 placeholder:text-zinc-400"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  input.trim() && !isLoading
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
            <p className="text-[10px] text-center text-zinc-400 mt-2">
              Gobiga AI may display inaccurate info, including about people, so double-check its responses.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
