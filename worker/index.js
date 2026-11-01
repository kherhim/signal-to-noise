import { handleSubscribe } from './subscribe.mjs';

export default {
  async fetch(request, env) {
    return handleSubscribe(request, env);
  },
};
