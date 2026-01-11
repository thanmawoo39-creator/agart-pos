/**
 * AI Failover System
 * Provides automatic failover from Gemini to Groq when primary AI service fails
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiAI, hasGeminiApiKey, getGroqApiKey, hasGroqApiKey, isLocalAiEnabled, getLocalAiUrl } from './gemini-config';
import { callOllamaVisionAPI } from './local-ai';
import { callGeminiVisionAPI } from './gemini';

// Groq SDK - using fetch for simple API calls
interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResult {
  success: boolean;
  data?: any;
  confidence_score?: number;
  raw?: string;
  amount?: number;
  transactionId?: string;
  warnings?: string[];
  isValid?: boolean;
  provider?: 'gemini' | 'groq' | 'ollama' | 'fallback';
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
  model: string, // Accept model as parameter
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
      model: model, // Use the provided model
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
    preferredModel?: 'gemini-3-flash' | 'gemini-1.5-flash' | 'gemini-2.5-pro' | 'llama-3.3-70b-versatile' | 'mixtral-8x7b-32768';
    preferredProvider?: 'gemini' | 'groq'; // New option to specify preferred provider
    skipGemini?: boolean; // Keep for explicit skipping
    skipGroq?: boolean; // New option to skip Groq
  }
): Promise<{
  success: boolean;
  content: string;
  provider: 'gemini' | 'groq' | 'fallback';
  error?: string;
}> {
  const model = options?.preferredModel || 'llama-3.3-70b-versatile'; // Default to a Groq model
  const preferredProvider = options?.preferredProvider || 'groq'; // Default to Groq

  // Prioritize based on preferredProvider
  if (preferredProvider === 'groq' && !options?.skipGroq) {
    // Try Groq first
    try {
      console.log('[AI Failover] Attempting Groq API as primary...');

      const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const groqResponse = await callGroqAPI(messages, model); // Pass model here

      console.log('[AI Failover] ✓ Groq API succeeded');
      return {
        success: true,
        content: groqResponse,
        provider: 'groq',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[AI Failover] ✗ Groq API failed as primary:', errorMsg);
      console.log('[AI Failover] Groq primary failed, falling over to Gemini...');
    }
  }

  // Then try Gemini (if not skipped and if Groq wasn't preferred or failed)
  if (!options?.skipGemini) {
    try {
      console.log('[AI Failover] Attempting Gemini API...');

      if (await hasGeminiApiKey()) {
        const genAI = await getGeminiAI();
        const geminiModel = genAI.getGenerativeModel({ model: options?.preferredModel || 'gemini-3-flash' }); // Use Gemini-specific default model

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
        console.log('[AI Failover] Gemini API key not configured, trying Groq or fallback...');
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
        console.log('[AI Failover] Gemini rate limit/error detected...');
      }
    }
  }
  
  // If Groq was preferred but skipped, or Gemini was preferred and failed, try Groq again if not skipped
  if (preferredProvider === 'gemini' && !options?.skipGroq) {
      try {
          console.log('[AI Failover] Attempting Groq API as fallback...');

          const messages: GroqMessage[] = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
          ];

          const groqResponse = await callGroqAPI(messages, model);

          console.log('[AI Failover] ✓ Groq API succeeded');
          return {
              success: true,
              content: groqResponse,
              provider: 'groq',
          };
      } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[AI Failover] ✗ Groq API failed:', errorMsg);
      }
  }

  // Final fallback - return generic message
  console.log('[AI Failover] All AI services failed, returning fallback message');
  return {
    success: false,
    content: 'AI is currently busy. Please try again in a few moments.',
    provider: 'fallback',
    error: 'All configured AI services failed or were unavailable.',
  };
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
    preferredModel?: 'gemini-3-flash' | 'gemini-1.5-flash' | 'gemini-2.5-pro' | 'llama-3.3-70b-versatile' | 'mixtral-8x7b-32768';
    preferredProvider?: 'gemini' | 'groq'; // New option to specify preferred provider
  }
): Promise<{
  success: boolean;
  fullContent: string;
  provider: 'gemini' | 'groq' | 'fallback';
  error?: string;
}> {
  const model = options?.preferredModel || 'llama-3.3-70b-versatile'; // Default to a Groq model
  const preferredProvider = options?.preferredProvider || 'groq'; // Default to Groq

  // Prioritize based on preferredProvider
  if (preferredProvider === 'groq') {
    // Try Groq first (non-streaming for now as Groq streaming not implemented)
    try {
      console.log('[AI Failover] Attempting Groq API as primary (non-streaming)...');

      const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const groqResponse = await callGroqAPI(messages, model); // Pass model here

      onToken(groqResponse); // Send full response at once

      console.log('[AI Failover] ✓ Groq API succeeded');
      return {
        success: true,
        fullContent: groqResponse,
        provider: 'groq',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[AI Failover] ✗ Groq API failed as primary:', errorMsg);
      console.log('[AI Failover] Groq primary failed, falling over to Gemini streaming...');
    }
  }

  // Then try Gemini streaming
  try {
    console.log('[AI Failover] Attempting Gemini streaming API...');

    if (await hasGeminiApiKey()) {
      const genAI = await getGeminiAI();
      const geminiModel = genAI.getGenerativeModel({ model: options?.preferredModel || 'gemini-3-flash' }); // Use Gemini-specific default model

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
      console.log('[AI Failover] Gemini API key not configured, trying Groq or fallback...');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[AI Failover] ✗ Gemini streaming failed:', errorMsg);
    console.log('[AI Failover] Gemini failed, falling over to Groq...');
  }
  
  // If Gemini was preferred but failed, try Groq again if not already tried as primary
  if (preferredProvider === 'gemini') {
    try {
      console.log('[AI Failover] Attempting Groq API as fallback (non-streaming)...');

      const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const groqResponse = await callGroqAPI(messages, model);

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
    }
  }

  // Final fallback
  const fallbackMsg = 'AI is currently busy. Please try again in a few moments.';
  onToken(fallbackMsg);

  console.log('[AI Failover] All AI services failed, returning fallback message');
  return {
    success: false,
    fullContent: fallbackMsg,
    provider: 'fallback',
    error: 'All configured AI services failed or were unavailable.',
  };
}

/**
 * Generate vision-based response with failover
 * Tries Local AI (Ollama) first, falls back to Gemini on error or if disabled
 */
export async function generateVisionWithFailover(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<AIResult> {
  // Try Local AI first if enabled
  if (await isLocalAiEnabled()) {
    try {
      console.log('[AI Failover] Attempting Local AI (Ollama) API...');
      const localAiResult = await callOllamaVisionAPI(imageBuffer, prompt);
      if (localAiResult.success) {
        console.log('[AI Failover] ✓ Local AI (Ollama) API succeeded');
        return { ...localAiResult, provider: 'ollama' };
      }
      console.warn('[AI Failover] ✗ Local AI (Ollama) failed, failing over to Gemini...');
    } catch (error) {
      console.error('[AI Failover] ✗ Local AI (Ollama) threw an error:', error);
    }
  }

  // Fallback to Gemini
  try {
    console.log('[AI Failover] Attempting Gemini API as fallback...');
    const geminiResult = await callGeminiVisionAPI(imageBuffer, mimeType, prompt);
    if (geminiResult.success) {
      console.log('[AI Failover] ✓ Gemini API succeeded');
      return { ...geminiResult, provider: 'gemini' };
    }
    // Return Gemini's failure response if it didn't throw
    return { ...geminiResult, provider: 'gemini' };
  } catch (error: any) {
    console.error('[AI Failover] ✗ Gemini API failed:', error);
    return {
      success: false,
      raw: error.message,
      warnings: ['Both local AI and Gemini failed.'],
      provider: 'fallback',
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
