// Toutes les routes /api/* du site (Cloudflare Pages Functions) : voir functions/_lib/api.js.
import { handle } from '../_lib/api.js';

export const onRequest = (context) => handle(context.request, context.env);
