import { request } from 'undici';
import type { ModelProvider } from '../types.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  provider: ModelProvider;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

function buildUrl(baseUrl: string, pathSuffix: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const suffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  if (trimmed.endsWith('/v1') || trimmed.endsWith('/v2') || /\/v\d+$/.test(trimmed)) {
    return `${trimmed}${suffix}`;
  }
  return `${trimmed}/v1${suffix}`;
}

function buildHeaders(provider: ModelProvider) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  if (provider.headers) {
    for (const [k, v] of Object.entries(provider.headers)) {
      headers[k] = v;
    }
  }
  return headers;
}

export async function chatCompletion(input: ChatInput): Promise<string> {
  const { provider, messages, temperature = 0.8, maxTokens, model } = input;
  const url = buildUrl(provider.baseUrl, '/chat/completions');
  const body = {
    model: model || provider.model,
    messages,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    stream: false,
  };
  const res = await request(url, {
    method: 'POST',
    headers: buildHeaders(provider),
    body: JSON.stringify(body),
  });
  const text = await res.body.text();
  if (res.statusCode >= 400) {
    throw new Error(`Model API error ${res.statusCode}: ${text.slice(0, 800)}`);
  }
  try {
    const json = JSON.parse(text);
    const choice = json.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string') {
      throw new Error(`Unexpected response shape: ${text.slice(0, 400)}`);
    }
    return content;
  } catch (e: any) {
    throw new Error(`Failed to parse model response: ${e?.message || e}`);
  }
}

export async function testConnection(provider: ModelProvider): Promise<{ ok: boolean; message: string }> {
  try {
    const reply = await chatCompletion({
      provider,
      messages: [
        { role: 'system', content: 'You are a connectivity probe. Reply with OK.' },
        { role: 'user', content: 'ping' },
      ],
      temperature: 0,
      maxTokens: 8,
    });
    return { ok: true, message: reply.trim().slice(0, 200) || 'OK' };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}
