import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  TrendingUp,
} from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FloatingAIButtonProps {
  /** Whether the FAB should be visible */
  visible?: boolean;
  /** Optional className for positioning overrides */
  className?: string;
  /** Function to calculate today's profit */
  calculateTodayProfit?: () => number;
  /** Function to prepare sales data for prediction */
  prepareSalesDataForPrediction?: () => { name: string; totalQuantity: number }[] | null;
  /** Alerts data for risk analysis */
  alertsData?: { alerts: { type: string; staffName: string; message: string }[] };
}

/**
 * FloatingAIButton - Circular FAB for Gemini AI Assistant
 *
 * Positioned at bottom-right, above bottom navigation on mobile
 * Features Gemini brand colors and subtle glow effect
 */
export function FloatingAIButton({
  visible = true,
  className,
  calculateTodayProfit,
  prepareSalesDataForPrediction,
  alertsData,
}: FloatingAIButtonProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<GeminiMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if ((streamingContent || messages.length > 0) && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [streamingContent, messages.length]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const geminiMutation = useMutation({
    mutationFn: async (questionText: string) => {
      setStreamingContent('');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch('/api/gemini/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: questionText, language: i18n.language }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                }
              } catch {
                // ignore parse errors
              }
            }
          }

          return { response: fullContent };
        }

        const data: unknown = await response.json().catch(() => ({}));
        let responseText = '';
        if (typeof data === 'string') {
          responseText = data;
        } else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if (typeof obj['answer'] === 'string') responseText = obj['answer'];
          else if (typeof obj['response'] === 'string') responseText = obj['response'];
        }

        return { response: String(responseText ?? '') };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onMutate: () => {
      setPendingMessage('Generating response—may take up to 60 seconds.');
      setStreamingContent('');
    },
    onSuccess: (data) => {
      setPendingMessage('');
      setStreamingContent('');

      let content = data.response;
      if (typeof content === 'string') {
        try {
          const parsed: unknown = JSON.parse(content);
          if (Array.isArray(parsed)) {
            content = parsed.map((item) => {
              if (typeof item === 'string') return `• ${item}`;
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                if (typeof obj['suggestion'] === 'string') return `• ${obj['suggestion']}`;
                if (typeof obj['text'] === 'string') return `• ${obj['text']}`;
              }
              return `• ${JSON.stringify(item)}`;
            }).join('\n\n');
          }
        } catch {
          // Not JSON, use as-is
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    },
    onError: () => {
      setPendingMessage('');
      setStreamingContent('');
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Unable to get response. Please try again.' }]);
    },
  });

  const handleAsk = () => {
    if (!question.trim() || geminiMutation.isPending) return;

    let enhancedQuestion = question;

    // Add profit information
    if (calculateTodayProfit) {
      const profit = calculateTodayProfit();
      if (profit !== 0) {
        enhancedQuestion += `\n\nToday's Net Profit: $${profit.toFixed(2)}`;
      }
    }

    // Add sales data
    if (prepareSalesDataForPrediction) {
      const salesData = prepareSalesDataForPrediction();
      if (salesData && salesData.length > 0) {
        enhancedQuestion += `\n\nRecent Sales Data (Last 7 Days):\n`;
        salesData.forEach((product) => {
          const avgDaily = (product.totalQuantity / 7).toFixed(1);
          enhancedQuestion += `- ${product.name}: Sold ${product.totalQuantity} total units (avg ${avgDaily} per day)\n`;
        });
      }
    }

    // Add alerts data
    if (alertsData?.alerts && alertsData.alerts.length > 0) {
      const discrepancies = alertsData.alerts.filter((a) => a.type === 'shift_discrepancy');
      if (discrepancies.length > 0) {
        enhancedQuestion += `\n\nRecent Shift Discrepancies:\n`;
        discrepancies.slice(0, 5).forEach((alert) => {
          enhancedQuestion += `- ${alert.staffName}: ${alert.message}\n`;
        });
      }
    }

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    geminiMutation.mutate(enhancedQuestion);
    setQuestion('');
  };

  if (!visible) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          // Base styles
          'fixed z-40 flex items-center justify-center',
          'w-14 h-14 rounded-full',
          // Gemini gradient colors
          'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500',
          // Glow effect
          'shadow-lg shadow-purple-500/40',
          // Hover/active states
          'hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105',
          'active:scale-95',
          'transition-all duration-200',
          // Position: bottom-right, above bottom nav on mobile
          'bottom-20 right-4 md:bottom-6 md:right-6',
          className
        )}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-white" />
        {/* Pulse animation ring */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-ping opacity-20" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 bg-background flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom duration-300',
            // Mobile: 90% height bottom sheet
            'inset-x-0 bottom-0 top-[10%] rounded-t-2xl',
            // Desktop: centered modal
            'md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
            isFullscreen
              ? 'md:w-[95vw] md:h-[95vh] md:max-w-none md:rounded-xl'
              : 'md:w-full md:max-w-lg md:h-auto md:max-h-[85vh] md:rounded-xl md:shadow-2xl'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Gemini AI Assistant</h2>
                <p className="text-[10px] text-muted-foreground">Ask about your business</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 hidden md:flex"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Today's Profit Card */}
          {calculateTodayProfit && (
            <div className="flex-shrink-0 mx-4 mt-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Today's Net Profit</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(calculateTodayProfit())}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-3" ref={scrollAreaRef}>
              {messages.length === 0 && !streamingContent && (
                <div className="text-center py-8">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-500/50" />
                  <p className="text-sm text-muted-foreground">Ask me anything about your business</p>
                  <p className="text-xs text-muted-foreground mt-1">E.g., "Which products should I restock?"</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'bg-muted'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm max-w-[85%]">
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1" />
                  </div>
                </div>
              )}

              {geminiMutation.isPending && !streamingContent && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      Thinking...
                    </div>
                  </div>
                  {pendingMessage && (
                    <p className="text-xs text-muted-foreground">{pendingMessage}</p>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex-shrink-0 flex gap-2 p-4 border-t bg-background pb-safe">
            <Input
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              className="flex-1 h-11"
            />
            <Button
              onClick={handleAsk}
              disabled={!question.trim() || geminiMutation.isPending}
              className="h-11 w-11 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingAIButton;
