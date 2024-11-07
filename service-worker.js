const PREFLIGHT_CACHE_NAME = 'preflight-cache';
const PREFLIGHT_CACHE_MAX_AGE = 60 * 60; // 1 hour in seconds

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('/.toddle/api-proxy/')) {
    event.respondWith(
      (async () => {
        try {
          const originalRequest = event.request.clone();

          // Handle preflight requests
          if (originalRequest.method === 'OPTIONS') {
            // Try to get cached preflight response first
            const cachedResponse = await caches.match(originalRequest);
            if (cachedResponse) {
              return cachedResponse;
            }

            // Get the target URL from headers
            let targetUrl = originalRequest.headers.get('X-Toddle-Url');
            if (!targetUrl) {
              throw new Error('X-Toddle-Url header is missing');
            }
            targetUrl = targetUrl.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');

            // Make the actual OPTIONS request to the target URL
            const preflightRequest = new Request(targetUrl, {
              method: 'OPTIONS',
              headers: originalRequest.headers,
              mode: 'cors',
              credentials: originalRequest.credentials
            });

            const preflightResponse = await fetch(preflightRequest);
            
            // Create a new response with the headers from the actual preflight
            const cachedPreflightResponse = new Response(null, {
              status: 204,
              headers: {
                'Access-Control-Allow-Origin': preflightResponse.headers.get('Access-Control-Allow-Origin') || '*',
                'Access-Control-Allow-Methods': preflightResponse.headers.get('Access-Control-Allow-Methods') || 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': preflightResponse.headers.get('Access-Control-Allow-Headers') || '*',
                'Access-Control-Max-Age': PREFLIGHT_CACHE_MAX_AGE.toString(),
                'Access-Control-Allow-Credentials': preflightResponse.headers.get('Access-Control-Allow-Credentials') || 'true',
              }
            });

            // Cache the preflight response
            const preflightCache = await caches.open(PREFLIGHT_CACHE_NAME);
            await preflightCache.put(originalRequest, cachedPreflightResponse.clone());

            return cachedPreflightResponse;
          }

          // Rest of the code for handling regular requests
          let targetUrl = originalRequest.headers.get('X-Toddle-Url');
          
          if (!targetUrl) {
            throw new Error('X-Toddle-Url header is missing');
          }

          targetUrl = targetUrl.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');

          const processedHeaders = new Headers();
          originalRequest.headers.forEach((value, key) => {
            const processedValue = value.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');
            processedHeaders.append(key, processedValue);
          });

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