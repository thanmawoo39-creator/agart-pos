async function testGeminiModel() {
  console.log('🧪 Testing Gemini API with gemini-3-pro model...');
  
  try {
    const response = await fetch('http://localhost:5000/api/ai/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'What is 2 + 2?'
      })
    });
    
    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const text = await response.text();
      console.log('📊 Response body:', text);
      console.log('✅ Gemini API test successful');
    } else {
      console.log('❌ Gemini API test failed');
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing Gemini:', error);
  }
}

testGeminiModel();
