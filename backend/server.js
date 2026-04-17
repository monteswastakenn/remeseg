import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client (solo para logs y métricas) ───────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── Instancia de Fastify ──────────────────────────────────────────────────────
const app = Fastify({ logger: true });

// ── CORS: permite peticiones desde Angular ────────────────────────────────────
// FRONTEND_URL puede ser una URL única o una lista separada por comas
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
  : [];

await app.register(cors, {
  origin: (origin, cb) => {
    // Sin FRONTEND_URL configurado → permitir todo (modo desarrollo)
    if (allowedOrigins.length === 0) return cb(null, true);
    // Siempre permitir localhost en cualquier puerto
    if (!origin || /^https?:\/\/localhost/.test(origin)) return cb(null, true);
    // Verificar contra la lista configurada
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin no permitido: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer', 'Range'],
  credentials: true,
});

// ── Rate Limiting global (máximo 100 req / minuto por IP) ─────────────────────
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Demasiadas peticiones. Intenta de nuevo en ${context.after}.`,
  }),
});

// ── reply-from: reenvía peticiones a Supabase ─────────────────────────────────
await app.register(replyFrom, {
  base: process.env.SUPABASE_URL,
});

// ── Helper: guardar log en audit_logs ────────────────────────────────────────
async function saveLog({ method, endpoint, statusCode, userId, ip }) {
  try {
    await supabase.from('audit_logs').insert({
      user_id:    userId ?? null,
      action:     method.toLowerCase(),   // get, post, patch, delete
      resource:   endpoint,
      ip_address: ip ?? null,
    });
  } catch (e) {
    app.log.warn('Error guardando log: ' + e.message);
  }
}

// ── Helper: guardar métrica en api_metrics ────────────────────────────────────
async function saveMetric({ endpoint, method, statusCode, responseMs, userId }) {
  try {
    await supabase.from('api_metrics').insert({
      endpoint,
      method:      method.toLowerCase(),
      status_code: statusCode,
      response_ms: responseMs,
      user_id:     userId ?? null,
    });
  } catch (e) {
    app.log.warn('Error guardando métrica: ' + e.message);
  }
}

// ── Helper: extraer user_id del token JWT de Supabase ────────────────────────
function extractUserId(authHeader) {
  try {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROXY ROUTE: reenvía todo /api/* → Supabase REST API
// Ejemplo: GET /api/rest/v1/tickets → Supabase /rest/v1/tickets
// ─────────────────────────────────────────────────────────────────────────────
app.all('/api/*', async (req, reply) => {
  const start = Date.now();

  // Extraer user_id del token
  const userId = extractUserId(req.headers['authorization']);

  // Construir la ruta destino en Supabase (quita el prefijo /api)
  const targetPath = req.url.replace(/^\/api/, '');

  // Reenviar con reply-from (mantiene headers, body, método, etc.)
  await reply.from(targetPath, {
    rewriteRequestHeaders: (_req, headers) => ({
      ...headers,
      // Inyectar la API key de Supabase (así Angular no necesita exponerla)
      apikey: process.env.SUPABASE_KEY,
    }),
    onResponse: async (_req, _reply, res) => {
      const responseMs = Date.now() - start;
      const endpoint   = targetPath.split('?')[0]; // sin query params

      // Guardar log y métrica en paralelo (sin bloquear la respuesta)
      saveLog({
        method:     req.method,
        endpoint,
        statusCode: res.statusCode,
        userId,
        ip:         req.ip,
      });
      saveMetric({
        endpoint,
        method:      req.method,
        statusCode:  res.statusCode,
        responseMs,
        userId,
      });
    },
  });
});

// ── Health check propio del gateway ──────────────────────────────────────────
app.get('/health', async () => {
  const { error } = await supabase.auth.getSession();
  return {
    status: error ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    supabase: error ? 'unreachable' : 'connected',
  };
});

// ── Arrancar servidor ─────────────────────────────────────────────────────────
try {
  const port = parseInt(process.env.PORT ?? '3000');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 API Gateway corriendo en http://0.0.0.0:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
