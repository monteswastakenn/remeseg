import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import replyFrom from '@fastify/reply-from';
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';

// ── CONFIGURACIÓN DE VARIABLES ──────────────────────────────────────────────
const rawUrl = process.env.SUPABASE_URL || '';
const rawKey = process.env.SUPABASE_KEY || '';
const rawFront = process.env.FRONTEND_URL || '';
const databaseUrl = process.env.DATABASE_URL || '';

const supabaseUrl = rawUrl.replace(/['"]+/g, '').trim();
const supabaseKey = rawKey.replace(/['"]+/g, '').trim();
const frontendUrl = rawFront.replace(/['"]+/g, '').trim();

const TICKETS_URL = process.env.TICKETS_SERVICE_URL || 'http://localhost:3001';
const GROUPS_URL = process.env.GROUPS_SERVICE_URL || 'http://localhost:3002';
const USERS_URL = process.env.USERS_SERVICE_URL || 'http://localhost:3003';

console.log('--- API GATEWAY CONFIGURADO (Microservicios) ---');

// Cliente Supabase (Para fallback y Auth)
const supabase = createClient(supabaseUrl, supabaseKey);

// Pool de Postgres (Solo para métricas internas en el Gateway)
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

const app = Fastify({ logger: true });

// ── UTILIDADES DE AUTH ──────────────────────────────────────────────────────
const extractUserId = (authHeader) => {
    if (!authHeader) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
    } catch (e) { return null; }
};

// ── HOOKS GLOBALES ──────────────────────────────────────────────────────────
app.addHook('preHandler', async (req) => {
    req.startTime = Date.now();
    // Inyectar X-User-Id para que los microservicios lo usen
    const userId = extractUserId(req.headers.authorization);
    if (userId) {
        req.headers['x-user-id'] = userId;
    }
});

app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    const userId = request.headers['x-user-id'] || null;
    const endpoint = request.url.split('?')[0].split('/').pop() || 'unknown';

    // Guardar métricas de rendimiento global
    await pool.query(
        'INSERT INTO api_metrics (endpoint, method, status_code, response_ms, user_id) VALUES ($1, $2, $3, $4, $5)',
        [endpoint, request.method, reply.statusCode, duration, userId]
    ).catch(err => console.error('Error metrics:', err));
});

// ── ORQUESTACIÓN DE MICROSERVICIOS ───────────────────────────────────────────

// Mapeo de Tablas a Microservicios
const serviceMap = {
    'tickets': TICKETS_URL,
    'groups': GROUPS_URL,
    'users': USERS_URL
};

app.all('/api/rest/v1/:table', async (request, reply) => {
    const { table } = request.params;
    const targetBase = serviceMap[table];

    if (targetBase) {
        app.log.info(`📡 Proxying ${request.method} to ${table} service -> ${targetBase}`);
        
        return reply.from(request.url.replace(/^\/api/, ''), {
            base: targetBase,
            rewriteRequestHeaders: (request, headers) => ({
                ...headers,
                apikey: supabaseKey,
                'x-user-id': headers['x-user-id']
            })
        });
    }

    // FALLBACK: Si no es una tabla dedicada, usar proxy directo a Supabase
    const targetPath = request.url.replace(/^\/api/, '');
    app.log.info(`☁️ Fallback proxy to Supabase: ${targetPath}`);
    
    return reply.from(targetPath, {
        base: supabaseUrl,
        rewriteRequestHeaders: (request, headers) => ({
            ...headers,
            apikey: supabaseKey,
        })
    });
});

// Proxy para Auth y otras rutas
app.all('/api/*', async (req, reply) => {
    const targetPath = req.url.replace(/^\/api/, '');
    return reply.from(targetPath, {
        base: supabaseUrl,
        rewriteRequestHeaders: (request, headers) => ({
            ...headers,
            apikey: supabaseKey,
        })
    });
});

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ORQUESTADOR DE MICROSERVICIOS (Railway Compatibility) ─────────────────────
const spawnService = (name, filePath, port) => {
    console.log(`🚀 Master Orchestrator: Spawning ${name} service on port ${port}...`);
    
    const child = spawn('node', [filePath], {
        env: { ...process.env, PORT: port, [name.toUpperCase() + '_PORT']: port },
        stdio: 'inherit' // Forward logs to main console
    });

    child.on('error', (err) => {
        console.error(`❌ Master Orchestrator: Failed to start ${name}:`, err);
    });

    child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.warn(`⚠️ Master Orchestrator: ${name} service exited with code ${code}. Restarting in 5s...`);
            setTimeout(() => spawnService(name, filePath, port), 5000);
        }
    });

    return child;
};

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────
const start = async () => {
    try {
        // En producción (Railway), iniciamos los microservicios automáticamente
        if (process.env.NODE_ENV === 'production' || true) { // Forzado a true para asegurar que corran
            spawnService('Tickets', path.join(__dirname, 'services/tickets/index.js'), 3001);
            spawnService('Groups', path.join(__dirname, 'services/groups/index.js'), 3002);
            spawnService('Users', path.join(__dirname, 'services/users/index.js'), 3003);
        }

        await app.register(cors, { origin: true });
        await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
        await app.register(replyFrom, { base: supabaseUrl });

        app.get('/health', async () => ({ status: 'ok', gateway: 'active' }));

        const port = process.env.PORT || 3000;
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        console.log(`🚀 API GATEWAY ORCHESTRATOR READY ON PORT ${port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
