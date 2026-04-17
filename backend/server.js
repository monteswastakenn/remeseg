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

const app = Fastify({ 
    logger: true,
    disableRequestLogging: false 
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
