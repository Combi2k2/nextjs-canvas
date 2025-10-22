'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X } from 'lucide-react';
import { useAIVoice } from '@/hooks/useAIVoice';

interface AiChatboxProps {
    x: number;
    y: number;
    onClose: () => void;
    onSubmit: (prompt: string) => Promise<void>;
    onVoiceStart?: () => void;
    onVoiceEnd?: () => void;
    isVoiceSupported?: boolean;
}

export default function AiChatbox({
    x,
    y,
    onClose,
    onSubmit,
    onVoiceStart,
    onVoiceEnd,
    isVoiceSupported = false
}: AiChatboxProps) {
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Use the new useAIVoice hook
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
        onVoiceStart,
        onVoiceEnd
    );

    useEffect(() => {
        // Focus input when component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Update prompt with real-time voice recognition
    useEffect(() => {
        if (voiceState.isListening) {
            // Combine final transcript and interim transcript for real-time display
            const currentVoiceText = voiceState.transcript + voiceState.interimTranscript;
            
            if (currentVoiceText) {
                // Update the prompt input with current voice recognition
                setPrompt(prev => {
                    // Remove any previous voice text and add current voice text
                    const textWithoutVoice = prev.replace(/🎤.*$/g, '').trim();
                    return textWithoutVoice + (textWithoutVoice ? ' ' : '') + `🎤 ${currentVoiceText}`;
                });
            }
        }
    }, [voiceState.transcript, voiceState.interimTranscript, voiceState.isListening]);

    // Handle final transcript when voice recognition stops
    useEffect(() => {
        if (voiceState.transcript && !voiceState.isListening) {
            // Replace the voice placeholder with final transcript
            setPrompt(prev => {
                const finalText = prev.replace(/🎤.*$/g, voiceState.transcript).trim();
                return finalText;
            });
            resetTranscript();
        }
    }, [voiceState.transcript, voiceState.isListening, resetTranscript]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim() && !isProcessing) {
            setIsProcessing(true);
            try {
                // Clean up voice text before submitting
                const cleanPrompt = prompt.replace(/🎤.*$/g, '').trim();
                await onSubmit(cleanPrompt);
                setPrompt('');
                // Close chatbox after successful submission
                onClose();
            } catch (error) {
                console.error('Error submitting prompt:', error);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleVoiceToggle = () => {
        if (voiceState.isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <div
            className="ai-chatbox"
            style={{
                position: 'absolute',
                left: Math.max(10, x - 200),
                top: Math.max(10, y - 200),
                zIndex: 10000,
                width: '400px',
                maxHeight: '500px'
            }}
        >
            <div className="ai-chatbox-content">
                <div className="ai-chatbox-header">
                    <span className="ai-chatbox-title">AI Assistant</span>
                    <button
                        className="ai-chatbox-close"
                        onClick={onClose}
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="ai-chatbox-form">
                    <div className="ai-chatbox-input-container">
                        <input
                            ref={inputRef}
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={voiceState.isListening ? "Listening..." : "Describe what you want to improve..."}
                            className={`ai-chatbox-input ${voiceState.isListening ? 'listening' : ''}`}
                            disabled={isProcessing}
                            style={{
                                backgroundColor: voiceState.isListening ? '#f0f9ff' : undefined,
                                borderColor: voiceState.isListening ? '#3b82f6' : undefined
                            }}
                        />
                        
                        {isVoiceSupported && voiceState.isSupported && (
                            <button
                                type="button"
                                className={`ai-chatbox-voice ${voiceState.isListening ? 'listening' : ''}`}
                                onClick={handleVoiceToggle}
                                disabled={isProcessing}
                                title={voiceState.isListening ? 'Stop listening' : 'Start voice input'}
                            >
                                {voiceState.isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                        )}
                        
                        <button
                            type="submit"
                            className="ai-chatbox-send"
                            disabled={!prompt.trim() || isProcessing}
                            title="Send prompt"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
                
                {/* Voice recognition status - removed as requested */}
                
                {/* Error display */}
                {voiceState.error && (
                    <div className="ai-chatbox-error">
                        <span>{voiceState.error}</span>
                    </div>
                )}
                
                {isProcessing && (
                    <div className="ai-chatbox-processing">
                        <div className="ai-processing-spinner"></div>
                        <span>Processing with AI...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
