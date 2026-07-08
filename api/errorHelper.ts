import { logger } from './logger.js';

export interface FormattedError {
  error: string;
  exception?: string;
}

export function formatError(error: string, exception?: string, stack?: string): FormattedError {
  if (stack) {
    logger.error('internal_error_stack', stack);
  }
  const response: FormattedError = { error };
  if (exception) {
    response.exception = exception;
  }
  return response;
}
