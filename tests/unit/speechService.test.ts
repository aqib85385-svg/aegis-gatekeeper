import { describe, it, expect, vi } from 'vitest';

const mockSpeechSynthesis = {
  getVoices: vi.fn().mockReturnValue([
    { name: 'Spanish Voice', lang: 'es-ES' },
    { name: 'English Voice', lang: 'en-US' }
  ]),
  speak: vi.fn(),
  cancel: vi.fn(),
  onvoiceschanged: null as any
};

if (typeof window === 'undefined') {
  (globalThis as any).window = { speechSynthesis: mockSpeechSynthesis } as any;
} else {
  (window as any).speechSynthesis = mockSpeechSynthesis;
}

(globalThis as any).SpeechSynthesisUtterance = class {
  text: string;
  lang: string = 'en-US';
  rate: number = 1.0;
  pitch: number = 1.0;
  voice: any = null;
  constructor(text: string) {
    this.text = text;
  }
} as any;

import { speechService } from '../../src/services/speechService';

describe('SpeechService', () => {
  it('should initialize and cache voices if speechSynthesis is available', () => {
    expect(speechService).toBeDefined();
    // Simulate voices changed callback
    if (mockSpeechSynthesis.onvoiceschanged) {
      mockSpeechSynthesis.onvoiceschanged();
    }
  });

  it('should speak text in the specified language', () => {
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();

    speechService.speak('Hola', 'es-ES');

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    
    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Hola');
    expect(utterance.lang).toBe('es-ES');
    expect(utterance.voice).toBeDefined();
    expect(utterance.voice.lang).toBe('es-ES');
  });

  it('should fall back to default voice if preferred language voice is not matched', () => {
    mockSpeechSynthesis.speak.mockClear();
    speechService.speak('Bonjour', 'fr-FR');
    
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Bonjour');
    expect(utterance.lang).toBe('fr-FR');
  });

  it('should handle cancel requests', () => {
    mockSpeechSynthesis.cancel.mockClear();
    speechService.cancel();
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});
