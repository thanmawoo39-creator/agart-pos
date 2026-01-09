(async () => {
  try {
    const body = { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=' };
    const res = await fetch('http://127.0.0.1:5000/api/identify-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('Status:', res.status);
    const txt = await res.text();
    try {
      console.log('JSON:', JSON.parse(txt));
    } catch (e) {
      console.log('Body:', txt);
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
