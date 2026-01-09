import { getLocalAiUrl } from './gemini-config';
import type { AIResult } from './ai-failover';

// Helper function to prepare base64 image data for Ollama API
function prepareOllamaImageData(imageBuffer: Buffer): string {
  return imageBuffer.toString('base64');
}

export async function callOllamaVisionAPI(imageBuffer: Buffer, prompt:string): Promise<AIResult> {
  const localAiUrl = 'http://localhost:11434';

  const imageData = prepareOllamaImageData(imageBuffer);

  try {
    const response = await fetch(`${localAiUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'moondream',
        prompt: prompt,
        images: [imageData],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', errorText);
      return {
        success: false,
        warnings: [`Ollama API error: ${response.statusText}`],
        raw: errorText,
      };
    }

    const result = await response.json();
    
    // The response from Ollama is a JSON object with a `response` field containing the stringified JSON.
    const nestedJson = JSON.parse(result.response);

    return {
      success: true,
      data: {
        name: nestedJson.name,
      },
      confidence_score: nestedJson.confidence_score,
      raw: result.response,
    };

  } catch (error: any) {
    console.error('Failed to call Ollama API:', error);
    return {
      success: false,
      warnings: ['Failed to connect to Local AI service.'],
      raw: error.message,
    };
  }
}
