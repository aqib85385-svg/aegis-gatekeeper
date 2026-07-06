export function formatError(error, exception, stack) {
  if (stack) {
    console.error('[INTERNAL ERROR STACK]', stack);
  }
  const response = { error };
  if (exception) {
    response.exception = exception;
  }
  return response;
}
