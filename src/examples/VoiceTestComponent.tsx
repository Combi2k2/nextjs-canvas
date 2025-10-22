// Test component to demonstrate the improved voice recognition
import React from 'react';
import { useAIVoice } from '@/hooks/useAIVoice';

export const VoiceTestComponent: React.FC = () => {
  const handleVoiceStart = () => {
    console.log('🎤 Voice recognition started');
  };

  const handleVoiceEnd = () => {
    console.log('🛑 Voice recognition ended (explicitly stopped)');
  };

  const {
    state: voiceState,
    startListening,
    stopListening,
    resetTranscript
  } = useAIVoice(
    {
      language: 'en-US',
      continuous: true, // Always continuous for manual control
      interimResults: true,
      maxAlternatives: 1
    },
    handleVoiceStart,
    handleVoiceEnd
  );

  return (
    <div className="voice-test" style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Voice Recognition Test</h3>
      
      {/* Status */}
      <div style={{ marginBottom: '10px' }}>
        <p><strong>Status:</strong> {voiceState.isListening ? '🎤 Listening' : '⏸️ Stopped'}</p>
        <p><strong>Supported:</strong> {voiceState.isSupported ? '✅ Yes' : '❌ No'}</p>
        {voiceState.error && <p style={{ color: 'red' }}><strong>Error:</strong> {voiceState.error}</p>}
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={startListening}
          disabled={voiceState.isListening || !voiceState.isSupported}
          style={{ 
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: voiceState.isListening ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: voiceState.isListening ? 'not-allowed' : 'pointer'
          }}
        >
          🎤 Start Listening
        </button>
        
        <button 
          onClick={stopListening}
          disabled={!voiceState.isListening}
          style={{ 
            marginRight: '10px',
            padding: '10px 20px',
            backgroundColor: !voiceState.isListening ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: !voiceState.isListening ? 'not-allowed' : 'pointer'
          }}
        >
          🛑 Stop Listening
        </button>
        
        <button 
          onClick={resetTranscript}
          disabled={voiceState.isListening}
          style={{ 
            padding: '10px 20px',
            backgroundColor: voiceState.isListening ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: voiceState.isListening ? 'not-allowed' : 'pointer'
          }}
        >
          🔄 Reset
        </button>
      </div>

      {/* Transcript Display */}
      <div style={{ border: '1px solid #ddd', padding: '15px', backgroundColor: '#f9f9f9' }}>
        <h4>Real-time Transcript:</h4>
        
        {/* Final transcript */}
        {voiceState.transcript && (
          <div style={{ marginBottom: '10px' }}>
            <strong>Final:</strong> 
            <span style={{ color: '#28a745', fontWeight: 'bold' }}> {voiceState.transcript}</span>
          </div>
        )}
        
        {/* Interim transcript */}
        {voiceState.interimTranscript && (
          <div>
            <strong>Interim:</strong> 
            <span style={{ color: '#007bff', fontStyle: 'italic' }}> &quot;{voiceState.interimTranscript}&quot;</span>
          </div>
        )}
        
        {/* Combined display (as shown in chatbox) */}
        {voiceState.isListening && (voiceState.transcript || voiceState.interimTranscript) && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
            <strong>Live Display:</strong>
            <span style={{ color: '#1976d2' }}>
              🎤 {voiceState.transcript + voiceState.interimTranscript}
            </span>
          </div>
        )}
        
        {!voiceState.transcript && !voiceState.interimTranscript && (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No speech detected yet...</p>
        )}
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <h4>Instructions:</h4>
        <ul>
          <li>Click &quot;Start Listening&quot; to begin voice recognition</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch the real-time transcript update as you speak</li>
          <li>Click &quot;Stop Listening&quot; to end voice recognition</li>
          <li>Note: onVoiceEnd is only triggered by explicit stop, not speech pauses</li>
        </ul>
      </div>
    </div>
  );
};

