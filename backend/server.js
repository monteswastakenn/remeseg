import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';

// ── CONFIGURACIÓN DE VARIABLES ──────────────────────────────────────────────
const rawUrl = process.env.SUPABASE_URL || '';
const rawKey = process.env.SUPABASE_KEY || '';
const rawFront = process.env.FRONTEND_URL || '';
const dbUrl = process.env.DATABASE_URL || '';

const supabaseUrl = rawUrl.replace(/['"]+/g, '').trim();
const supabaseKey = rawKey.replace(/['"]+/g, '').trim();
const frontendUrl = rawFront.replace(/['"]+/g, '').trim();
const databaseUrl = dbUrl.replace(/\[YOUR-PASSWORD\]/g, process.env.SUPABASE_PG_PASSWORD || '').trim();

console.log('--- INICIO DE GATEWAY UNIFICADO ---');
console.log('URL de Base de Datos:', databaseUrl ? 'OK (Presente)' : 'FALTA');

// Cliente Supabase (Para Auth y compatibilidad)
const supabase = createClient(supabaseUrl, supabaseKey);

// Pool de Postgres (Para SQL Directo)
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

const app = Fastify({ 
    logger: true,
    disableRequestLogging: false 
});

// ── UTILIDADES DE LOGGING & AUTH ─────────────────────────────────────────────
const extractUserId = (authHeader) => {
    if (!authHeader) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
    } catch (e) { return null; }
};

// ── HOOKS GLOBALES (Métricas) ────────────────────────────────────────────────
app.addHook('preHandler', async (req) => {
    req.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    const userId = extractUserId(request.headers.authorization);
    const endpoint = request.url.split('?')[0].split('/').pop() || 'unknown';

    // Guardar métrica mediante SQL directo para máxima velocidad
    await pool.query(
        'INSERT INTO api_metrics (endpoint, method, status_code, response_ms, user_id) VALUES ($1, $2, $3, $4, $5)',
        [endpoint, request.method, reply.statusCode, duration, userId]
    ).catch(err => console.error('Error metrics:', err));
});

// ── MANEJADOR UNIFICADO DE CRUD (Reemplaza microservicios) ────────────────────
app.all('/api/rest/v1/:table', async (request, reply) => {
    const { table } = request.params;
    const method = request.method;
    const userId = extractUserId(request.headers.authorization);
    
    try {
        let result;
        
        if (method === 'GET') {
            // Manejo de filtros simples (eq.)
            let query = `SELECT * FROM ${table}`;
            const params = [];
            const filters = Object.keys(request.query).filter(k => k !== 'select' && k !== 'order');
            
            if (filters.length > 0) {
                query += ' WHERE ' + filters.map((key, i) => {
                    const val = request.query[key].replace('eq.', '');
                    params.push(val);
                    return `${key} = $${i + 1}`;
                }).join(' AND ');
            }
            
            if (request.query.order) {
                const [col, dir] = request.query.order.split('.');
                query += ` ORDER BY ${col} ${dir.toUpperCase()}`;
            }

            result = await pool.query(query, params);
            return result.rows;
        }

        if (method === 'POST') {
            const keys = Object.keys(request.body);
            const values = Object.values(request.body);
            const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
            result = await pool.query(query, values);
            
            // Log de auditoría
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, new_value, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'insert', table, request.body, request.ip]
            );

            reply.code(201);
            return result.rows; // PostgREST devuelve array
        }

        if (method === 'PATCH') {
            const id = request.query.id.replace('eq.', '');
            const keys = Object.keys(request.body);
            const values = Object.values(request.body);
            const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
            const query = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
            result = await pool.query(query, [...values, id]);

            // Log de auditoría
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, resource_id, new_value, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, 'update', table, id, request.body, request.ip]
            );

            return result.rows;
        }

        if (method === 'DELETE') {
            const id = request.query.id.replace('eq.', '');
            await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

            // Log de auditoría
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'delete', table, id, request.ip]
            );

            reply.code(204);
            return null;
        }

    } catch (err) {
        console.error(`Error en operación ${method} sobre ${table}:`, err);
        reply.code(500).send({ error: err.message });
    }
});

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────
const start = async () => {
    try {
        await app.register(cors, { origin: true });
        await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });
        
        // Proxy para otras rutas (Auth, etc.)
        if (supabaseUrl) {
            await app.register(replyFrom, { base: supabaseUrl });
        }

        app.get('/health', async () => ({ status: 'ok', db: 'connected' }));

        // FALLBACK PROXY: Si no es una de nuestras rutas manuales, reenviar a Supabase
        app.all('/api/*', async (req, reply) => {
            const targetPath = req.url.replace(/^\/api/, '');
            return reply.from(targetPath, {
                rewriteRequestHeaders: (request, headers) => ({
                    ...headers,
                    apikey: supabaseKey,
                })
            });
        });

        const port = process.env.PORT || 3000;
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        console.log(`🚀 UNIFIED GATEWAY READY ON PORT ${port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
