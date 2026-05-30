'use client'

import { useState, useRef, useEffect } from 'react'
import { Brain, Send, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  confidence?: number
  isStreaming?: boolean
}

interface Citation {
  video_title: string
  timestamp_start: number
  quote?: string
}

const STARTER_QUESTIONS = [
  'How does the principle of adaptability apply to startup strategy?',
  'What does Bruce Lee mean by "be like water" in a business context?',
  'How can I apply the concept of timing to negotiations?',
  'Explain the principle of intercepting — how does this apply to investing?',
  'What does efficiency of motion teach us about leadership?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Welcome to MentorOS. I'm here to help you explore Bruce Lee's wisdom — grounded in actual video evidence.\n\nAsk me anything about his principles, actions, or how to apply his philosophy across business, leadership, investing, and life.",
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (message: string) => {
    if (!message.trim() || isStreaming) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    }

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                fullContent += parsed.chunk
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: fullContent, isStreaming: !parsed.done }
                      : m
                  )
                )
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: 'I encountered an error. Please try again.',
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold">Bruce Lee — Mentor Chat</h1>
          <p className="text-xs text-muted-foreground">Grounded in analyzed video evidence</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="mr-3 h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  msg.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.isStreaming && (
                  <span className="inline-block h-4 w-0.5 bg-primary animate-pulse ml-0.5" />
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Sources:</p>
                    {msg.citations.map((c, i) => (
                      <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {c.video_title} @ {c.timestamp_start.toFixed(0)}s
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Starter Questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {STARTER_QUESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl flex gap-3">
          <Input
            ref={inputRef}
            placeholder="Ask about Bruce Lee's wisdom, principles, or applications..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(input)
              }
            }}
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            onClick={() => handleSend(input)}
            disabled={isStreaming || !input.trim()}
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Responses grounded in analyzed video evidence. May contain errors.
        </p>
      </div>
    </div>
  )
}
