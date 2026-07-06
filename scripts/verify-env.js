if (!process.env.GEMINI_API_KEY) {
  console.error('==================================================');
  console.error('FATAL STARTUP ERROR: GEMINI_API_KEY is not set!');
  console.error('Please configure GEMINI_API_KEY in your environment.');
  console.error('==================================================');
  process.exit(1);
}
console.log('Environment validation successful: GEMINI_API_KEY is configured.');
