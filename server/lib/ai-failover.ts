/**
 * AI Failover System
 * Provides automatic failover from Gemini to Groq when primary AI service fails
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiAI, hasGeminiApiKey, getGroqApiKey, hasGroqApiKey } from './gemini-config';

// Groq SDK - using fetch for simple API calls
interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqCompletionRequest {
  messages: GroqMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Call Groq API as fallback
 */
async function callGroqAPI(
  messages: GroqMessage[],
  stream: boolean = false
): Promise<string> {
  const GROQ_API_KEY = await getGroqApiKey();

  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured. Please set it in Settings or add GROQ_API_KEY to environment variables.');
  }

  console.log('[AI Failover] Calling Groq API...');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model: 'llama-3.3-70b-versatile', // Fast and capable Groq model
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    } as GroqCompletionRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from Groq';
}

/**
 * Generate text with automatic failover
 * Tries Gemini first, falls back to Groq on error
 */
export async function generateWithFailover(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    preferredModel?: 'gemini-1.5-flash' | 'gemini-2.5-pro';
    skipGemini?: boolean;
  }
): Promise<{
  success: boolean;
  content: string;
  provider: 'gemini' | 'groq' | 'fallback';
  error?: string;
}> {
  const model = options?.preferredModel || 'gemini-2.5-pro';

  // Try Gemini first (unless explicitly skipped)
  if (!options?.skipGemini) {
    try {
      console.log('[AI Failover] Attempting Gemini API...');

      if (await hasGeminiApiKey()) {
        const genAI = await getGeminiAI();
        const geminiModel = genAI.getGenerativeModel({ model });

        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const result = await geminiModel.generateContent([fullPrompt]);
        const response = result.response.text();

        console.log('[AI Failover] ✓ Gemini API succeeded');
        return {
          success: true,
          content: response,
          provider: 'gemini',
        };
      } else {
        console.log('[AI Failover] Gemini API key not configured, trying Groq...');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[AI Failover] ✗ Gemini API failed:', errorMsg);

      // Check if it's a rate limit or server error
      if (
        errorMsg.includes('429') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('500') ||
        errorMsg.includes('503')
      ) {
        console.log('[AI Failover] Gemini rate limit/error detected, failing over to Groq...');
      }
    }
  }

  // Fallback to Groq
  try {
    console.log('[AI Failover] Attempting Groq API as fallback...');

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const groqResponse = await callGroqAPI(messages);

    console.log('[AI Failover] ✓ Groq API succeeded');
    return {
      success: true,
      content: groqResponse,
      provider: 'groq',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[AI Failover] ✗ Groq API failed:', errorMsg);

    // Final fallback - return generic message
    console.log('[AI Failover] Both AI services failed, returning fallback message');
    return {
      success: false,
      content: 'AI is currently busy. Please try again in a few moments.',
      provider: 'fallback',
      error: errorMsg,
    };
  }
}

/**
 * Generate streaming response with failover
 * Only supports Gemini streaming for now, Groq returns full response
 */
export async function generateStreamingWithFailover(
  systemPrompt: string,
  userPrompt: string,
  onToken: (token: string) => void,
  options?: {
    preferredModel?: 'gemini-1.5-flash' | 'gemini-2.5-pro';
  }
): Promise<{
  success: boolean;
  fullContent: string;
  provider: 'gemini' | 'groq' | 'fallback';
  error?: string;
}> {
  const model = options?.preferredModel || 'gemini-2.5-pro';

  // Try Gemini streaming first
  try {
    console.log('[AI Failover] Attempting Gemini streaming API...');

    if (await hasGeminiApiKey()) {
      const genAI = await getGeminiAI();
      const geminiModel = genAI.getGenerativeModel({ model });

      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const result = await geminiModel.generateContentStream([fullPrompt]);

      let fullResponse = '';
      for await (const chunk of result.stream) {
        const text = chunk.text() || '';
        fullResponse += text;
        onToken(text);
      }

      console.log('[AI Failover] ✓ Gemini streaming succeeded');
      return {
        success: true,
        fullContent: fullResponse,
        provider: 'gemini',
      };
    } else {
      console.log('[AI Failover] Gemini API key not configured, trying Groq...');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[AI Failover] ✗ Gemini streaming failed:', errorMsg);
    console.log('[AI Failover] Gemini failed, failing over to Groq...');
  }

  // Fallback to Groq (non-streaming)
  try {
    console.log('[AI Failover] Attempting Groq API as fallback...');

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const groqResponse = await callGroqAPI(messages);

    // Send full response at once since Groq streaming isn't implemented
    onToken(groqResponse);

    console.log('[AI Failover] ✓ Groq API succeeded');
    return {
      success: true,
      fullContent: groqResponse,
      provider: 'groq',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[AI Failover] ✗ Groq API failed:', errorMsg);

    // Final fallback
    const fallbackMsg = 'AI is currently busy. Please try again in a few moments.';
    onToken(fallbackMsg);

    console.log('[AI Failover] Both AI services failed, returning fallback message');
    return {
      success: false,
      fullContent: fallbackMsg,
      provider: 'fallback',
      error: errorMsg,
    };
  }
}

/**
 * Check if either AI service is available
 */
export async function isAIServiceAvailable(): Promise<{
  gemini: boolean;
  groq: boolean;
  anyAvailable: boolean;
}> {
  const hasGemini = await hasGeminiApiKey();
  const hasGroq = await hasGroqApiKey();

  return {
    gemini: hasGemini,
    groq: hasGroq,
    anyAvailable: hasGemini || hasGroq,
  };
}
