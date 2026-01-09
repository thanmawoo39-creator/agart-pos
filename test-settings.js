const http = require('http');

// Test GET settings
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/settings',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();
