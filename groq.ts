export async function callGroqVisionAPI(imageBuffer: Buffer, prompt: string) {
  if (!process.env.GROQ_API_KEY) {
    return { success: false, warnings: ["GROQ_API_KEY not found in environment variables"] };
  }

  try {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, warnings: ["No content received from Groq"] };
    }

    const parsed = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (error) {
    console.error("Groq Vision API Error:", error);
    return { success: false, warnings: [(error as Error).message] };
  }
}