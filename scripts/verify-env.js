if (!process.env.GEMINI_API_KEY) {
  console.warn('==================================================');
  console.warn('STARTUP WARNING: GEMINI_API_KEY is not set!');
  console.warn('Please configure GEMINI_API_KEY in your environment variables.');
  console.warn('==================================================');
} else {
  console.log('Environment validation successful: GEMINI_API_KEY is configured.');
}
