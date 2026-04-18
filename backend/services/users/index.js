import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL || '';

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

const app = Fastify({ logger: true });

const getUserId = (req) => req.headers['x-user-id'] || null;

// --- CRUD USERS ---
app.all('/rest/v1/users', async (request, reply) => {
    const method = request.method;
    const currentUserId = getUserId(request);
    
    try {
        let result;
        
        if (method === 'GET') {
            let query = 'SELECT * FROM users';
            const params = [];
            const filters = Object.keys(request.query).filter(k => k !== 'id' && k !== 'select' && k !== 'order');
            
            // Handle ID specially if present in query
            if (request.query.id) {
                const idVal = request.query.id.replace('eq.', '');
                query += ' WHERE id = $1';
                params.push(idVal);
            } else if (filters.length > 0) {
                query += ' WHERE ' + filters.map((key, i) => {
                    const val = request.query[key].replace('eq.', '');
                    params.push(val);
                    return `${key} = $${i + 1}`;
                }).join(' AND ');
            }
            
            if (request.query.order) {
                const [col, dir] = request.query.order.split('.');
                query += ` ORDER BY ${col} ${dir ? dir.toUpperCase() : 'ASC'}`;
            }

            result = await pool.query(query, params);
            return result.rows;
        }

        if (method === 'POST') {
            const keys = Object.keys(request.body);
            const values = Object.values(request.body);
            const query = `INSERT INTO users (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
            result = await pool.query(query, values);
            
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, new_value, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [currentUserId, 'insert', 'users', JSON.stringify(request.body), request.ip]
            ).catch(e => console.error('Audit Error:', e));

            reply.code(201);
            return result.rows;
        }

        if (method === 'PATCH') {
            if (!request.query.id) throw new Error('Query parameter "id" is required for PATCH');
            const id = request.query.id.replace('eq.', '');
            const keys = Object.keys(request.body);
            const values = Object.values(request.body);
            const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
            const query = `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
            result = await pool.query(query, [...values, id]);

            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, new_value, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [currentUserId, 'update', 'users', JSON.stringify({ id, ...request.body }), request.ip]
            ).catch(e => console.error('Audit Error:', e));

            return result.rows;
        }

        if (method === 'DELETE') {
            const id = request.query.id.replace('eq.', '');
            await pool.query('DELETE FROM users WHERE id = $1', [id]);

            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [currentUserId, 'delete', 'users', id, request.ip]
            );

            reply.code(204);
            return null;
        }

    } catch (err) {
        console.error('Error en Microservicio Usuarios:', err);
        reply.code(500).send({ error: err.message });
    }
});

const start = async () => {
    try {
        await app.register(cors, { 
            origin: true,
            methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-user-id', 'Prefer'],
            credentials: true
        });
        const port = process.env.USERS_PORT || 3003;
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        console.log(`👤 USERS MICROSERVICE RUNNING ON PORT ${port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
