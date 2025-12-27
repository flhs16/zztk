// Simple Worker to serve static HTML files
export default {
  async fetch(request, env) {
    // Get the path from the request URL
    const url = new URL(request.url);
    let path = url.pathname;
    
    // Default to index.html for root path
    if (path === '/') {
      path = '/index.html';
    }
    
    // Try to fetch the file from the assets
    try {
      const file = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
      
      // If the file exists, return it
      if (file.status !== 404) {
        return file;
      }
      
      // If file not found, fall back to index.html for SPA routing
      return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    } catch (error) {
      // Return index.html for any errors
      return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }
  }
};