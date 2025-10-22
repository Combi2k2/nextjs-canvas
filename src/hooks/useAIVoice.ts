import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
}

interface UseAIVoiceReturn {
  state: VoiceRecognitionState;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
}

export const useAIVoice = (
  options: VoiceRecognitionOptions = {},
  onVoiceStart?: () => void,
  onVoiceEnd?: () => void
): UseAIVoiceReturn => {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1
  } = options;

  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if speech recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setState(prev => ({
        ...prev,
        isSupported: false,
        error: 'Speech recognition is not supported in this browser'
      }));
      return;
    }

    // Initialize recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Always continuous for manual stop control
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = maxAlternatives;

    // Event handlers
    recognition.onstart = () => {
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null
      }));
      onVoiceStart?.();
    };

    recognition.onend = () => {
      // Only update state, don't trigger onVoiceEnd here
      // onVoiceEnd should only be triggered by explicit user action
      setState(prev => ({
        ...prev,
        isListening: false
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setState(prev => ({
        ...prev,
        transcript: prev.transcript + finalTranscript,
        interimTranscript: interimTranscript
      }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error occurred';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech was detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone was found. Please ensure a microphone is connected.';
          break;
        case 'not-allowed':
          errorMessage = 'Permission to use microphone is denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error occurred during speech recognition.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service is not allowed.';
          break;
        case 'bad-grammar':
          errorMessage = 'Speech recognition grammar error.';
          break;
        case 'language-not-supported':
          errorMessage = 'The selected language is not supported.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setState(prev => ({
        ...prev,
        isListening: false,
        error: errorMessage
      }));
      
      // Only trigger onVoiceEnd for certain errors, not for natural speech pauses
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onVoiceEnd?.();
      }
    };

    recognition.onnomatch = () => {
      setState(prev => ({
        ...prev,
        error: 'No speech was recognized. Please try again.'
      }));
    };

    recognitionRef.current = recognition;
    isInitializedRef.current = true;

    setState(prev => ({
      ...prev,
      isSupported: true
    }));

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [language, continuous, interimResults, maxAlternatives, onVoiceStart, onVoiceEnd]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isInitializedRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Speech recognition is not initialized'
      }));
      return;
    }

    if (state.isListening) {
      return; // Already listening
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to start speech recognition'
      }));
    }
  }, [state.isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !state.isListening) {
      return;
    }

    try {
      recognitionRef.current.stop();
      // Trigger onVoiceEnd only when explicitly stopping
      onVoiceEnd?.();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to stop speech recognition'
      }));
    }
  }, [state.isListening, onVoiceEnd]);

  const resetTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      error: null
    }));
  }, []);

  return {
    state,
    startListening,
    stopListening,
    resetTranscript,
    onVoiceStart,
    onVoiceEnd
  };
};

// Alternative implementation using Google Cloud Speech API (for server-side)
// This would require a backend API endpoint to handle the streaming recognition
export const useGoogleCloudVoice = (
  apiKey: string,
  onVoiceStart?: () => void,
  onVoiceEnd?: () => void
) => {
  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendAudioToGoogleCloud(audioBlob);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null
      }));
      
      onVoiceStart?.();
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone'
      }));
    }
  }, [onVoiceStart]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && state.isListening) {
      mediaRecorderRef.current.stop();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setState(prev => ({
        ...prev,
        isListening: false
      }));
      
      onVoiceEnd?.();
    }
  }, [state.isListening, onVoiceEnd]);

  const sendAudioToGoogleCloud = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('apiKey', apiKey);

      const response = await fetch('/api/speech-recognition', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process audio');
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        transcript: prev.transcript + result.transcript
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to process speech recognition'
      }));
    }
  };

  const resetTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      error: null
    }));
  }, []);

  return {
    state,
    startListening,
    stopListening,
    resetTranscript,
    onVoiceStart,
    onVoiceEnd
  };
};

// Type declarations for browser compatibility
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
