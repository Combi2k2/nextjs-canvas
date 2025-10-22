// Example usage of useAIVoice hook
import React from 'react';
import { useAIVoice } from '@/hooks/useAIVoice';

export const VoiceExample: React.FC = () => {
  const {
    state: voiceState,
    startListening,
    stopListening,
    resetTranscript
  } = useAIVoice(
    {
      language: 'en-US',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1
    },
    () => console.log('Voice recognition started'),
    () => console.log('Voice recognition ended')
  );

  return (
    <div className="voice-example">
      <h3>Voice Recognition Example</h3>
      
      {/* Voice controls */}
      <div className="voice-controls">
        <button 
          onClick={startListening}
          disabled={voiceState.isListening || !voiceState.isSupported}
        >
          Start Listening
        </button>
        
        <button 
          onClick={stopListening}
          disabled={!voiceState.isListening}
        >
          Stop Listening
        </button>
        
        <button 
          onClick={resetTranscript}
          disabled={voiceState.isListening}
        >
          Reset Transcript
        </button>
      </div>

      {/* Status indicators */}
      <div className="voice-status">
        <p>Supported: {voiceState.isSupported ? 'Yes' : 'No'}</p>
        <p>Listening: {voiceState.isListening ? 'Yes' : 'No'}</p>
        {voiceState.error && <p className="error">Error: {voiceState.error}</p>}
      </div>

      {/* Transcript display */}
      <div className="transcript">
        <h4>Final Transcript:</h4>
        <p>{voiceState.transcript || 'No transcript yet'}</p>
        
        {voiceState.interimTranscript && (
          <>
            <h4>Interim Transcript:</h4>
            <p className="interim">{voiceState.interimTranscript}</p>
          </>
        )}
      </div>
    </div>
  );
};

// Example with Google Cloud Speech API (server-side)
export const GoogleCloudVoiceExample: React.FC = () => {
  const {
    state: voiceState,
    startListening,
    stopListening,
    resetTranscript
  } = useGoogleCloudVoice(
    process.env.NEXT_PUBLIC_SPEECH_API_KEY || '',
    () => console.log('Google Cloud voice recognition started'),
    () => console.log('Google Cloud voice recognition ended')
  );

  return (
    <div className="google-cloud-voice-example">
      <h3>Google Cloud Speech API Example</h3>
      
      <div className="voice-controls">
        <button 
          onClick={startListening}
          disabled={voiceState.isListening}
        >
          Start Google Cloud Recognition
        </button>
        
        <button 
          onClick={stopListening}
          disabled={!voiceState.isListening}
        >
          Stop Recognition
        </button>
      </div>

      <div className="transcript">
        <h4>Transcript:</h4>
        <p>{voiceState.transcript || 'No transcript yet'}</p>
        {voiceState.error && <p className="error">Error: {voiceState.error}</p>}
      </div>
    </div>
  );
};

