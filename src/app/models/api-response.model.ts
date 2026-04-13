/**
 * Modelo universal de respuesta estandarizada.
 * Todas las operaciones contra Supabase deben devolver este formato.
 *
 * statusCode: código HTTP semántico (200, 201, 403, 404, 500…).
 * intOpCode : identificador interno de la operación (ej. "SxUS200").
 * data      : payload de la respuesta (puede ser null en errores).
 */
export interface ApiResponse<T = any> {
  statusCode: number;
  intOpCode: string;
  data: T;
}
