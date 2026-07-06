export interface NormalizedErrorResponse {
  error: string;
  exception?: string;
}

export function formatError(error: string, exception?: string, stack?: string): NormalizedErrorResponse {
  if (stack) {
    console.error('[INTERNAL ERROR STACK]', stack);
  }
  const response: NormalizedErrorResponse = { error };
  if (exception) {
    response.exception = exception;
  }
  return response;
}
