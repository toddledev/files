self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('/.toddle/api-proxy/')) {
    event.respondWith(
      (async () => {
        try {
          const originalRequest = event.request.clone();
          
          // Get and process the target URL
          let targetUrl = originalRequest.headers.get('X-Toddle-Url');
          
          if (!targetUrl) {
            throw new Error('X-Toddle-Url header is missing');
          }

          // Replace token in URL if present
          targetUrl = targetUrl.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');

          // Process headers: clone and replace token in all header values
          const processedHeaders = new Headers();
          originalRequest.headers.forEach((value, key) => {
            const processedValue = value.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');
            processedHeaders.append(key, processedValue);
          });

          // Create new request with processed URL and headers
          const newRequest = new Request(targetUrl, {
            method: originalRequest.method,
            headers: processedHeaders,
            body: originalRequest.body,
            mode: 'cors',
            credentials: originalRequest.credentials,
            cache: originalRequest.cache
          });

          const response = await fetch(newRequest);
          return response;

        } catch (error) {
          console.error('Proxy request failed:', error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
  }
}); 