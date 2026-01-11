async function testCurrentServer() {
  console.log('🧪 Testing current server with updated model configuration...');
  
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
        console.log('✅ API call successful');
        console.log('AI Response:', aiJson.response);
        
        if (aiJson.response !== 'AI is currently busy. Please try again in a few moments.') {
          console.log('🎉 AI is working properly!');
        } else {
          console.log('⚠️ AI still falling back to default message');
        }
      } catch (e) {
        console.log('⚠️ Response was not valid JSON');
      }
    } else {
      console.log('❌ API call failed');
      const errorText = await aiResponse.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testCurrentServer();
