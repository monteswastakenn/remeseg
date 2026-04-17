import { Injectable } from '@angular/core';

/**
 * Rate Limiter Service
 *
 * Previene ataques de fuerza bruta y spam limitando cuántas veces
 * se puede ejecutar una acción en una ventana de tiempo específica.
 *
 * Ejemplo de uso:
 *   - Login: máximo 5 intentos por minuto
 *   - Registro: máximo 3 intentos por 5 minutos
 *   - Creación de tickets: máximo 10 por minuto
 *
 * Funciona 100% en el cliente (sin servidor), almacenando los
 * intentos en localStorage para que el bloqueo persista aunque
 * se recargue o cierre la pestaña del navegador.
 */

export interface RateLimitConfig {
  /** Número máximo de intentos permitidos en la ventana de tiempo */
  maxAttempts: number;
  /** Ventana de tiempo en milisegundos (ej: 60000 = 1 minuto) */
  windowMs: number;
}

export interface RateLimitStatus {
  /** Si está bloqueado (superó el límite) */
  isBlocked: boolean;
  /** Intentos restantes antes de bloquearse */
  attemptsRemaining: number;
  /** Segundos hasta que se resetea el bloqueo (0 si no está bloqueado) */
  retryAfterSeconds: number;
  /** Total de intentos realizados en la ventana actual */
  attemptsMade: number;
}

@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  private readonly PREFIX = 'rl_'; // prefijo para las keys de localStorage

  /** Lee los timestamps de intentos desde localStorage */
  private read(action: string): number[] {
    try {
      const raw = localStorage.getItem(this.PREFIX + action);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** Guarda los timestamps en localStorage */
  private write(action: string, timestamps: number[]): void {
    localStorage.setItem(this.PREFIX + action, JSON.stringify(timestamps));
  }

  /**
   * Registra un intento para la acción dada y devuelve si está permitida.
   *
   * @param action  Identificador único de la acción (ej: 'login', 'register')
   * @param config  Configuración del límite
   * @returns RateLimitStatus con el estado actual
   */
  attempt(action: string, config: RateLimitConfig): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Leer desde localStorage y filtrar intentos fuera de la ventana
    const prev = this.read(action).filter(t => t > windowStart);

    // Verificar si ya está bloqueado
    if (prev.length >= config.maxAttempts) {
      const oldest = prev[0];
      const retryAfterMs = oldest + config.windowMs - now;
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        attemptsMade: prev.length,
      };
    }

    // Registrar el nuevo intento y persistir
    prev.push(now);
    this.write(action, prev);

    return {
      isBlocked: false,
      attemptsRemaining: config.maxAttempts - prev.length,
      retryAfterSeconds: 0,
      attemptsMade: prev.length,
    };
  }

  /**
   * Solo consulta el estado SIN registrar un nuevo intento.
   * Útil para mostrar al usuario cuántos intentos le quedan.
   */
  check(action: string, config: RateLimitConfig): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const prev = this.read(action).filter(t => t > windowStart);

    if (prev.length >= config.maxAttempts) {
      const oldest = prev[0];
      const retryAfterMs = oldest + config.windowMs - now;
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        attemptsMade: prev.length,
      };
    }

    return {
      isBlocked: false,
      attemptsRemaining: config.maxAttempts - prev.length,
      retryAfterSeconds: 0,
      attemptsMade: prev.length,
    };
  }

  /**
   * Resetea los intentos de una acción (ej: al hacer login exitoso).
   */
  reset(action: string): void {
    localStorage.removeItem(this.PREFIX + action);
  }

  /**
   * Resetea TODOS los contadores (ej: al hacer logout).
   */
  resetAll(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

// ── Configuraciones de límite predefinidas para este proyecto ─────────────────

export const RATE_LIMITS = {
  /** Máximo 5 intentos de login por minuto */
  LOGIN: { maxAttempts: 5, windowMs: 60_000 } satisfies RateLimitConfig,

  /** Máximo 3 registros por 5 minutos */
  REGISTER: { maxAttempts: 3, windowMs: 5 * 60_000 } satisfies RateLimitConfig,

  /** Máximo 10 tickets creados por minuto */
  CREATE_TICKET: { maxAttempts: 10, windowMs: 60_000 } satisfies RateLimitConfig,

  /** Máximo 20 comentarios por minuto */
  COMMENT: { maxAttempts: 20, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;
