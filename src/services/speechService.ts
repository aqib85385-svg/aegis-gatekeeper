/**
 * Service for handling Text-to-Speech (TTS) synthesis using the Web Speech API.
 * Optimized for high-noise stadium environments with clear settings.
 */

class SpeechService {
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // 1. Load voices initially (synchronous in some browsers)
      this.cachedVoices = window.speechSynthesis.getVoices();

      // 2. Bind listener for asynchronous loading on browser thread startup
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  /**
   * Speaks the provided text in the target language.
   * If speech synthesis is not supported, fails silently.
   * @param text The text to speak aloud.
   * @param lang The language code (e.g., 'es-ES' or 'en-US').
   */
  public speak(text: string, lang: string = 'en-US'): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Speech synthesis is not supported in this browser.');
      return;
    }

    // Cancel any ongoing speech before starting new speech
    this.cancel();

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      
      // Speed up slightly for faster gate clearance, keeping it natural
      utterance.rate = 1.0; 
      utterance.pitch = 1.0;

      // Find an appropriate voice from cache or direct query if cache is empty
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith(lang)) || voices.find(v => v.lang.includes(lang.split('-')[0]));
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Failed to execute text-to-speech:', error);
    }
  }

  /**
   * Instantly stops any active voice synthesis.
   */
  public cancel(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechService = new SpeechService();
export default speechService;
