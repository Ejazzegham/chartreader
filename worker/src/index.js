export { Hub } from './hub.js';
const hub = (env) => env.HUB.get(env.HUB.idFromName('main'));
export default {
  fetch: (request, env) => (new URL(request.url).pathname === '/__ping' ? new Response('pong') : hub(env).fetch(request)),
  // Every 5 minutes: make sure the background alarm is running (it stops by itself when nobody has alerts on).
  scheduled: (_event, env) => hub(env).fetch('https://hub/__wake'),
};
