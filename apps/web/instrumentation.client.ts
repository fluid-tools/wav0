import { initBotId } from 'botid/client/core';
 
// Define the paths that need bot protection.
// These are paths that are routed to by your app.
// These can be:
// - API endpoints (e.g., '/api/checkout')
// - Server actions invoked from a page (e.g., '/dashboard')
// - Dynamic routes (e.g., '/api/create/*')
 
initBotId({
  protect: [
    {
      path: '/api/checkout',
      method: 'POST',
    },
    {
      // Wildcards can be used to expand multiple segments
      // /team/*/activate will match
      // /team/a/activate
      // /team/a/b/activate
      // /team/a/b/c/activate
      // ...
      path: '/team/*/activate',
      method: 'POST',
    },
    {
      // Wildcards can also be used at the end for dynamic routes
      path: '/api/user/*',
      method: 'POST',
    },
    {
      path: '/daw',
      method: 'GET',
    }
  ],
});