'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatViewProps {
  projectId: string;
  interviewCount: number;
  answerCount: number;
  questionCount: number;
}

export default function ChatView({ projectId, interviewCount, answerCount, questionCount }: ChatViewProps) {
  const lang = useIALang();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message for streaming
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch(`/api/interview-analysis/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: t('chat_error', lang) }));
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `${t('error', lang)}: ${errData.error ?? res.statusText}` };
          return updated;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `${t('error', lang)}: ${err instanceof Error ? err.message : t('connection_failed', lang)}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleClear() {
    if (streaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setInput('');
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="ia-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 340px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ia-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-accent)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ia-text)' }}>
              {t('chat_title', lang)}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ia-text-tertiary)' }}>
            {t('chat_based_on', lang)} {interviewCount} {t('interviews', lang)}, {answerCount} {t('answers', lang)}, {questionCount} {t('questions', lang)}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            className="ia-btn ia-btn-ghost ia-btn-sm"
            onClick={handleClear}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t('chat_clear', lang)}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <div
                className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'var(--ia-accent-light)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ia-accent)' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--ia-text)' }}>
                {t('chat_title', lang)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
                {t('chat_desc_prefix', lang)} {answerCount} {t('chat_desc_suffix', lang)}
              </p>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {([1, 2, 3, 4] as const).map((n) => {
                const suggestion = t(`chat_suggestion_${n}` as `chat_suggestion_${typeof n}`, lang);
                return (
                  <button
                    key={n}
                    className="ia-chat-suggestion"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`ia-chat-msg ${msg.role === 'user' ? 'ia-chat-msg--user' : 'ia-chat-msg--assistant'}`}
            >
              <div className="ia-chat-msg-icon">
                {msg.role === 'user' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                )}
              </div>
              <div className="ia-chat-msg-content">
                <span className="ia-chat-msg-role">
                  {msg.role === 'user' ? t('chat_you', lang) : t('chat_assistant', lang)}
                </span>
                <div className="ia-chat-msg-text">
                  {msg.content || (
                    <span className="ia-chat-typing">
                      <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      <span style={{ color: 'var(--ia-text-tertiary)', fontSize: '12px' }}>{t('chat_analyzing', lang)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4" style={{ borderTop: '1px solid var(--ia-border)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="ia-textarea flex-1"
            style={{ minHeight: '40px', maxHeight: '120px', resize: 'none', fontSize: '13px' }}
            placeholder={t('chat_placeholder', lang)}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            rows={1}
          />
          <button
            className="ia-btn ia-btn-primary flex-shrink-0"
            style={{ height: '40px', width: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
          >
            {streaming ? (
              <span className="ia-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('chat_hint', lang)}
        </p>
      </div>
    </div>
  );
}
