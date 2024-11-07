// Define cache name and max age for preflight cache
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
            // Try to get cached preflight response
            const cache = await caches.open(PREFLIGHT_CACHE_NAME);
            const cachedResponse = await cache.match(originalRequest);

            if (cachedResponse) {
              return cachedResponse;
            }

            // If no cache, proceed with preflight request
            const preflightResponse = await handlePreflightRequest(originalRequest);
            
            // Cache the preflight response
            const responseToCache = preflightResponse.clone();
            cache.put(originalRequest, responseToCache);

            return preflightResponse;
          }

          // Handle regular requests
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

// Handle preflight requests separately
async function handlePreflightRequest(request) {
  // Get target URL from the original request headers
  const targetUrl = request.headers.get('X-Toddle-Url')?.replace(/{{[\s]*cookies\.access_token[\s]*}}/g, 'andreas');
  
  if (!targetUrl) {
    throw new Error('X-Toddle-Url header is missing');
  }

  // Make the preflight request to the target URL
  const preflightResponse = await fetch(new Request(targetUrl, {
    method: 'OPTIONS',
    headers: request.headers,
    mode: 'cors'
  }));

  // Create a new response with cached headers
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': PREFLIGHT_CACHE_MAX_AGE.toString(),
      // Copy any additional CORS headers from the actual response
      ...Object.fromEntries(preflightResponse.headers.entries())
    }
  });
}

// Clean up old preflight cache entries periodically
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PREFLIGHT_CACHE_NAME);
        const requests = await cache.keys();
        const now = Date.now();

        for (const request of requests) {
          const response = await cache.match(request);
          const cacheTime = response.headers.get('x-cache-time');

          if (cacheTime && (now - parseInt(cacheTime)) > (PREFLIGHT_CACHE_MAX_AGE * 1000)) {
            await cache.delete(request);
          }
        }
      } catch (error) {
        console.error('Cache cleanup failed:', error);
      }
    })()
  );
}); 