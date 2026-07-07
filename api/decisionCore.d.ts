export function processDecision(
  body: any,
  platformName: string
): Promise<{ status: number; data: any }>;
