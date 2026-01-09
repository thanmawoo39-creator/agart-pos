/**
 * Gemini API Key Configuration
 * Handles dynamic API key retrieval with priority logic:
 * 1. Database (user-provided via settings UI)
 * 2. Environment variable (developer default)
 * 3. Error if neither is available
 */

import { storage } from '../storage';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Get Gemini API key with priority logic
 * @returns API key string
 * @throws Error if no API key is configured
 */
export async function getGeminiApiKey(): Promise<string> {
  try {
    // Priority 1: Try to get from database (user-provided)
    const settings = await storage.getAppSettings();
    if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
      console.log('✅ Using Gemini API key from database (user-provided)');
      return settings.geminiApiKey.trim();
    }

    // Priority 2: Fallback to environment variable (developer default)
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      console.log('⚠️ Using Gemini API key from environment variable (fallback)');
      return process.env.GEMINI_API_KEY.trim();
    }

    // Priority 3: No key available - throw error
    throw new Error('Gemini API key not configured. Please set it in Settings or add GEMINI_API_KEY to environment variables.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      throw error;
    }
    // If there's a database error, fallback to env
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      console.warn('⚠️ Database error, using environment variable fallback:', error);
      return process.env.GEMINI_API_KEY.trim();
    }
    throw new Error('Gemini API key not configured. Please set it in Settings or add GEMINI_API_KEY to environment variables.');
  }
}

/**
 * Get initialized GoogleGenerativeAI instance with dynamic API key
 * @returns Initialized GoogleGenerativeAI instance
 */
export async function getGeminiAI(): Promise<GoogleGenerativeAI> {
  const apiKey = await getGeminiApiKey();
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Check if Gemini API key is configured
 * @returns true if API key is available, false otherwise
 */
export async function hasGeminiApiKey(): Promise<boolean> {
  try {
    await getGeminiApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Groq API key with priority logic
 * @returns API key string or null if not configured
 */
export async function getGroqApiKey(): Promise<string | null> {
  try {
    // Priority 1: Try to get from database (user-provided)
    const settings = await storage.getAppSettings();
    if (settings.groqApiKey && settings.groqApiKey.trim() !== '') {
      console.log('✅ Using Groq API key from database (user-provided)');
      return settings.groqApiKey.trim();
    }

    // Priority 2: Fallback to environment variable (developer default)
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      console.log('⚠️ Using Groq API key from environment variable (fallback)');
      return process.env.GROQ_API_KEY.trim();
    }

    // Priority 3: No key available - return null
    return null;
  } catch (error) {
    // If there's a database error, fallback to env
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      console.warn('⚠️ Database error, using Groq environment variable fallback:', error);
      return process.env.GROQ_API_KEY.trim();
    }
    return null;
  }
}

/**
 * Check if Groq API key is configured
 * @returns true if API key is available, false otherwise
 */
export async function hasGroqApiKey(): Promise<boolean> {
  const key = await getGroqApiKey();
  return key !== null;
}
