import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import { createClient } from '@supabase/supabase-js';

// ── LIMPIEZA DE VARIABLES ───────────────────────────────────────────────────
const rawUrl = process.env.SUPABASE_URL || '';
const rawKey = process.env.SUPABASE_KEY || '';
const rawFront = process.env.FRONTEND_URL || '';

const supabaseUrl = rawUrl.replace(/['"]+/g, '').trim();
const supabaseKey = rawKey.replace(/['"]+/g, '').trim();
const frontendUrl = rawFront.replace(/['"]+/g, '').trim();

console.log('--- INICIO DE GATEWAY ---');
console.log('URL de Supabase detectada:', supabaseUrl || 'FALTA');
console.log('Key de Supabase detectada:', supabaseKey ? 'OK (Presente)' : 'FALTA');
console.log('Puerto asignado:', process.env.PORT || '3000');

const supabase = createClient(
    supabaseUrl || 'https://dummy.supabase.co', 
    supabaseKey || 'dummy'
);

// ── UTILIDADES DE LOGGING ──────────────────────────────────────────────────
const extractUserId = (authHeader) => {
    if (!authHeader) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub; // ID de usuario de Supabase
    } catch (e) {
        return null;
    }
};

const extractResource = (url) => {
    const parts = url.split('?')[0].split('/');
    // Buscamos el recurso después de /rest/v1/ o similar
    const restIdx = parts.indexOf('v1');
    return restIdx !== -1 && parts[restIdx + 1] ? parts[restIdx + 1] : 'unknown';
};

const app = Fastify({ 
    logger: true,
    disableRequestLogging: false 
});

// ── HOOKS DE LOGGING ────────────────────────────────────────────────────────
// Capturar cuerpo de la petición para auditoría
app.addHook('preHandler', async (req, reply) => {
    req.startTime = Date.now();
});

// Registrar Métricas de API y Logs de Auditoría
app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    const userId = extractUserId(request.headers.authorization);
    const endpoint = extractResource(request.url);
    const method = request.method;

    // 1. Guardar Métricas
    const { error: metricError } = await supabase.from('api_metrics').insert({
        endpoint,
        method,
        status_code: reply.statusCode,
        response_ms: duration,
        user_id: userId
    });

    if (metricError) console.error('Error guardando métricas:', metricError);

    // 2. Guardar Auditoría (Solo mutaciones exitosas)
    const mutations = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (mutations.includes(method) && reply.statusCode < 400) {
        const { error: auditError } = await supabase.from('audit_logs').insert({
            user_id: userId,
            action: method.toLowerCase() === 'post' ? 'insert' : (method.toLowerCase() === 'delete' ? 'delete' : 'update'),
            resource: endpoint,
            new_value: request.body || null,
            ip_address: request.ip,
            resource_id: request.query?.id ? request.query.id.replace('eq.', '') : null
        });

        if (auditError) console.error('Error guardando auditoría:', auditError);
    }
});

// ── HEALTH CHECK (Inmediato) ────────────────────────────────────────────────
app.get('/health', async (req, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// ── CONFIGURACIÓN DE PLUGINS ───────────────────────────────────────────────
const startServer = async () => {
    try {
        // Cors
        const allowedOrigins = frontendUrl ? frontendUrl.split(',').map(u => u.trim()) : [];
        await app.register(cors, {
            origin: (origin, cb) => {
                if (!origin || allowedOrigins.length === 0 || /^https?:\/\/localhost/.test(origin) || allowedOrigins.includes(origin)) {
                    return cb(null, true);
                }
                cb(new Error("CORS Blocked"), false);
            },
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer', 'Range'],
            credentials: true
        });

        // Proxy
        if (supabaseUrl) {
            await app.register(replyFrom, { base: supabaseUrl });
        }

        // Rate Limit
        await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

        // Ruta Proxy
        app.all('/api/*', async (req, reply) => {
            const targetPath = req.url.replace(/^\/api/, '');
            return reply.from(targetPath, {
                rewriteRequestHeaders: (request, headers) => ({
                    ...headers,
                    apikey: supabaseKey,
                })
            });
        });

        // ── ENCENDIDO ───────────────────────────────────────────────────────────
        const port = process.env.PORT || 3000;
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        
        console.log(`🚀 GATEWAY ENCENDIDO EN PUERTO ${port}`);
        console.log(`Ruta de salud disponible en: /health`);

    } catch (err) {
        console.error('❌ ERROR FATAL AL INICIAR:', err);
        process.exit(1);
    }
};

startServer();
