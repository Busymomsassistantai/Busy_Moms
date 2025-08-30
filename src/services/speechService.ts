// Text-to-Speech service using Web Speech API
export class SpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentVoice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;

  constructor() {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();
      
      // Voices might load asynchronously
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.loadVoices();
      }
    } else {
      console.warn('Text-to-speech not supported in this browser');
    }
  }

  private loadVoices() {
    if (!this.synthesis) return;
    
    this.voices = this.synthesis.getVoices();
    
    // Prefer female English voices for a friendly assistant feel
    const preferredVoices = [
      'Google UK English Female',
      'Microsoft Zira - English (United States)',
      'Alex',
      'Samantha',
      'Victoria'
    ];

    for (const voiceName of preferredVoices) {
      const voice = this.voices.find(v => v.name.includes(voiceName));
      if (voice) {
        this.currentVoice = voice;
        break;
      }
    }

    // Fallback to any English female voice
    if (!this.currentVoice) {
      this.currentVoice = this.voices.find(v => 
        v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
      ) || this.voices.find(v => v.lang.startsWith('en')) || this.voices[0] || null;
    }

    console.log('Available voices:', this.voices.length);
    console.log('Selected voice:', this.currentVoice?.name);
  }

  speak(text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    interrupt?: boolean;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis || !this.isEnabled) {
        resolve();
        return;
      }

      // Stop current speech if interrupt is true
      if (options?.interrupt !== false) {
        this.stop();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings
      if (this.currentVoice) {
        utterance.voice = this.currentVoice;
      }
      
      utterance.rate = options?.rate ?? 0.9; // Slightly slower for clarity
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = options?.volume ?? 0.8;

      // Event handlers
      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };

      // Start speaking
      this.synthesis.speak(utterance);
    });
  }

  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  pause() {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  resume() {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  isSupported(): boolean {
    return !!this.synthesis;
  }

  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  setVoice(voiceName: string) {
    const voice = this.voices.find(v => v.name === voiceName);
    if (voice) {
      this.currentVoice = voice;
    }
  }

  // Utility method to speak notifications
  async speakNotification(message: string) {
    try {
      await this.speak(message, { rate: 1.0, interrupt: false });
    } catch (error) {
      console.error('Failed to speak notification:', error);
    }
  }

  // Utility method to speak AI responses with a more conversational tone
  async speakAIResponse(message: string) {
    try {
      // Clean up the message for better speech
      const cleanMessage = message
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
        .replace(/`(.*?)`/g, '$1') // Remove code markdown
        .replace(/\n+/g, '. ') // Replace line breaks with pauses
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      await this.speak(cleanMessage, { 
        rate: 0.85, 
        pitch: 1.1, 
        interrupt: true 
      });
    } catch (error) {
      console.error('Failed to speak AI response:', error);
    }
  }
}

export const speechService = new SpeechService();