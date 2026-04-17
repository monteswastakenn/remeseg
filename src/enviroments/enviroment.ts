export const environment = {
    production: false,

    // ── API Gateway (Fastify en Railway) ──────────────────────────────────────
    // En desarrollo apunta a localhost; en prod se reemplaza por la URL de Railway.
    apiGatewayUrl: 'http://localhost:3000',

    // ── Supabase Auth (solo para login / logout / token refresh) ─────────────
    // La apikey NUNCA llega a Supabase directamente desde el front en prod;
    // el gateway la inyecta. Aquí se mantiene solo para el SDK de Auth.
    supabase: {
        url: 'https://disigmhgwkbmhmbeoseo.supabase.co',
        key: 'sb_publishable_jIFPJ1CLPHNG5lljyDk_Sg_7A4XhTra'
    }
};