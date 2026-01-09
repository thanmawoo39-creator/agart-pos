(async () => {
  try {
    const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    // Get products
    let res = await fetch('http://127.0.0.1:5000/api/products');
    const products = await res.json();
    console.log('Products count:', products.length);
    if (!products || products.length === 0) {
      console.error('No products available to patch');
      return;
    }
    const prod = products[0];
    console.log('Patching product:', prod.name, prod.id);
    // Patch product to include imageData
    res = await fetch(`http://127.0.0.1:5000/api/products/${prod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64 }),
    });
    console.log('Patch status:', res.status);
    const patched = await res.json();
    console.log('Patched product:', patched.id, patched.name, !!patched.imageData);

    // Now POST identify with exact same base64 (without data: prefix) or with
    // as the route accepts data URLs or raw base64.
    res = await fetch('http://127.0.0.1:5000/api/identify-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });
    console.log('Identify status:', res.status);
    const body = await res.text();
    try { console.log('Identify JSON:', JSON.parse(body)); } catch (e) { console.log('Identify body:', body); }
  } catch (err) {
    console.error('Flow failed:', err);
  }
})();
