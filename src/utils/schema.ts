import { z } from 'zod';

export const DecisionSchema = z.object({
  status: z.enum(['ALLOW', 'REVIEW', 'DENY']),
  action: z.string().max(100),
  explanation: z.string(),
  translation: z.string()
});

export type DecisionResponse = z.infer<typeof DecisionSchema>;

/**
 * Validates an arbitrary JSON response against the DecisionSchema.
 * If validation fails, returns a safe fallback decision of 'REVIEW' (Manual Review).
 */
export function safeParseDecision(data: unknown): DecisionResponse {
  if (!data || typeof data !== 'object') {
    return {
      status: 'REVIEW',
      action: 'Manual Review Needed',
      explanation: 'Invalid API response format (not an object).',
      translation: 'Por favor, espere a un supervisor para una revisión manual.'
    };
  }

  const result = DecisionSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  
  const errorMessage = result.error.issues
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join(', ');

  return {
    status: 'REVIEW',
    action: 'Manual Review Needed',
    explanation: `Schema validation failed: ${errorMessage}`,
    translation: 'Por favor, espere a un supervisor para una revisión manual.'
  };
}
