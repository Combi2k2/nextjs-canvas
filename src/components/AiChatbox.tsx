'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X } from 'lucide-react';

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
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Focus input when component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }

        // Initialize speech recognition if available
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setPrompt(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = () => {
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim() && !isProcessing) {
            setIsProcessing(true);
            try {
                await onSubmit(prompt.trim());
                setPrompt('');
            } catch (error) {
                console.error('Error submitting prompt:', error);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleVoiceToggle = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            onVoiceEnd?.();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
            onVoiceStart?.();
        }
    };

    return (
        <div
            className="ai-chatbox"
            style={{
                position: 'absolute',
                left: Math.max(10, x - 150),
                top: Math.max(10, y - 120),
                zIndex: 10000
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
                            placeholder="Describe what you want to improve..."
                            className="ai-chatbox-input"
                            disabled={isProcessing}
                        />
                        
                        {isVoiceSupported && (
                            <button
                                type="button"
                                className={`ai-chatbox-voice ${isListening ? 'listening' : ''}`}
                                onClick={handleVoiceToggle}
                                disabled={isProcessing}
                                title={isListening ? 'Stop listening' : 'Start voice input'}
                            >
                                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
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
