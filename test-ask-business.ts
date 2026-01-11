async function testAskBusiness() {
  console.log('🧪 Testing /api/ai/ask-business with gemini-3-pro model...');
  
  try {
    // First login to get session
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pin: '1234'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }
    
    // Get cookies from login response
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 Got session cookie');
    
    // Now test AI ask-business
    const aiResponse = await fetch('http://localhost:5000/api/ai/ask-business', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        prompt: 'What is 2 + 2? Please give a simple answer.'
      })
    });
    
    console.log('📊 AI Response status:', aiResponse.status);
    
    if (aiResponse.ok) {
      const aiText = await aiResponse.text();
      console.log('📊 AI Response body:', aiText);
      
      try {
        const aiJson = JSON.parse(aiText);
        console.log('✅ Gemini API test successful');
        console.log('AI Response:', aiJson.response);
      } catch (e) {
        console.log('⚠️ Response was not valid JSON');
      }
    } else {
      console.log('❌ Gemini API test failed');
      const errorText = await aiResponse.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing Gemini:', error);
  }
}

testAskBusiness();
