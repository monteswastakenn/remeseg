import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../enviroments/enviroment';

/**
 * SupabaseService — Solo para Autenticación.
 *
 * El acceso a datos (tablas) se realiza exclusivamente a través del
 * API Gateway (Fastify en Railway) usando HttpClient, no desde aquí.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
    readonly client: SupabaseClient;

    constructor() {
        this.client = createClient(
            environment.supabase.url,
            environment.supabase.key
        );
    }

    /** Devuelve el access_token JWT actual (para que el interceptor lo adjunte). */
    async getAccessToken(): Promise<string | null> {
        const { data } = await this.client.auth.getSession();
        return data.session?.access_token ?? null;
    }
}