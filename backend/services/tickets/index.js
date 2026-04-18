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

// El Gateway inyectara el ID de usuario en este header
const getUserId = (req) => req.headers['x-user-id'] || null;

// --- CRUD TICKETS ---
app.all('/api/rest/v1/tickets', async (request, reply) => {
    const method = request.method;
    const userId = getUserId(request);
    
    try {
        let result;
        
        if (method === 'GET') {
            let query = 'SELECT * FROM tickets';
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
            const query = `INSERT INTO tickets (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
            result = await pool.query(query, values);
            
            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, new_value, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'insert', 'tickets', request.body, request.ip]
            );

            reply.code(201);
            return result.rows;
        }

        if (method === 'PATCH') {
            const id = request.query.id.replace('eq.', '');
            const keys = Object.keys(request.body);
            const values = Object.values(request.body);
            const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
            const query = `UPDATE tickets SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
            result = await pool.query(query, [...values, id]);

            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, resource_id, new_value, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
                [userId, 'update', 'tickets', id, request.body, request.ip]
            );

            return result.rows;
        }

        if (method === 'DELETE') {
            const id = request.query.id.replace('eq.', '');
            await pool.query('DELETE FROM tickets WHERE id = $1', [id]);

            await pool.query(
                'INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'delete', 'tickets', id, request.ip]
            );

            reply.code(204);
            return null;
        }

    } catch (err) {
        console.error('Error en Microservicio Tickets:', err);
        reply.code(500).send({ error: err.message });
    }
});

const start = async () => {
    try {
        await app.register(cors, { origin: true });
        const port = process.env.TICKETS_PORT || 3001;
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        console.log(`🎫 TICKET MICROSERVICE RUNNING ON PORT ${port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
