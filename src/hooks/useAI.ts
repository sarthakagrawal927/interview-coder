import { useState, useCallback } from 'react';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const AI_CONFIG_KEY = 'dsa-prep-ai-config';

const MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  google: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-04-17'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
};

export function getModels(provider: AIProvider): string[] {
  return MODELS[provider] || [];
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { provider: 'openai', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

const SYSTEM_PROMPT = `You are a DSA (Data Structures & Algorithms) coding tutor embedded in a practice tool. The student is working on a coding problem and needs guidance.

RULES:
- NEVER give the full solution or complete code
- Give small, focused hints that guide thinking
- Ask Socratic questions to help them discover the approach
- If they're stuck, suggest the pattern or data structure to consider
- Point out edge cases they might be missing
- If their code has a bug, hint at WHERE the issue is, not HOW to fix it
- Keep responses concise (2-4 sentences max)
- Use code snippets only for tiny illustrations (1-2 lines max, pseudocode preferred)
- If they explicitly ask for the solution, politely decline and offer a stronger hint instead

You have context about the problem they're solving and their current code.`;

const OPENAI_COMPAT_URLS: Partial<Record<AIProvider, string>> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
};

async function streamOpenAICompat(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const url = OPENAI_COMPAT_URLS[config.provider] || OPENAI_COMPAT_URLS.openai!;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + systemContext },
        ...messages,
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${config.provider} API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch { }
      }
    }
  }
}

async function streamAnthropic(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      stream: true,
      system: SYSTEM_PROMPT + '\n\n' + systemContext,
      messages,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            onChunk(json.delta.text);
          }
        } catch { }
      }
    }
  }
}

async function streamGoogle(config: AIConfig, messages: AIMessage[], systemContext: string, onChunk: (text: string) => void, signal: AbortSignal) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + '\n\n' + systemContext }] },
        contents,
      }),
      signal,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google API error: ${res.status} - ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch { }
      }
    }
  }
}

export function useAI() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (
    userMessage: string,
    config: AIConfig,
    systemContext: string,
    signal?: AbortSignal,
  ) => {
    setError(null);
    const newMessages: AIMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsStreaming(true);

    let fullResponse = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const onChunk = (text: string) => {
      fullResponse += text;
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: fullResponse },
      ]);
    };

    try {
      const streamFn = config.provider === 'anthropic' ? streamAnthropic
        : config.provider === 'google' ? streamGoogle
        : streamOpenAICompat;

      await streamFn(config, newMessages, systemContext, onChunk, signal || new AbortController().signal);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, ask, clearMessages };
}
