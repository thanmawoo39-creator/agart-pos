console.log('=== API Key Check ===');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'SET' : 'NOT SET');

if (process.env.GROQ_API_KEY) {
  console.log('Groq API Key length:', process.env.GROQ_API_KEY.length);
  console.log('Groq API Key starts with:', process.env.GROQ_API_KEY.substring(0, 10) + '...');
}

if (process.env.GEMINI_API_KEY) {
  console.log('Gemini API Key length:', process.env.GEMINI_API_KEY.length);
  console.log('Gemini API Key starts with:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
}
