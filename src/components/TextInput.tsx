'use client';

import { useRef, useEffect } from 'react';
import { TextInput as TextInputType } from '@/types/annotations';

interface TextInputProps {
    textInput: TextInputType;
    onSubmit: (text: string) => void;
    onCancel: () => void;
}

export default function TextInput({ textInput, onSubmit, onCancel }: TextInputProps) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textInput.visible && textAreaRef.current) {
            textAreaRef.current.focus();
        }
    }, [textInput.visible]);

    const handleSubmit = () => {
        if (textAreaRef.current && textAreaRef.current.value.trim()) {
            onSubmit(textAreaRef.current.value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    if (!textInput.visible) return null;

    return (
        <div
            className="absolute bg-white border-2 border-blue-500 rounded-lg p-2 z-10 shadow-lg"
            style={{
                left: textInput.x + 50,
                top: textInput.y + 100,
                width: textInput.width,
                minHeight: textInput.height
            }}
        >
            <textarea
                ref={textAreaRef}
                className="w-full h-full border-none outline-none resize-none p-2 text-sm"
                placeholder="Type your text..."
                onBlur={handleSubmit}
                onKeyDown={handleKeyDown}
                defaultValue=""
            />
            <div className="text-xs text-gray-500 mt-1 flex justify-between">
                <span>Ctrl+Enter to finish</span>
                <span>Esc to cancel</span>
            </div>
        </div>
    );
}