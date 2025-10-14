'use client';

import { 
    Pencil, 
    Type, 
    FileImage, 
    Square, 
    MousePointer, 
    Eraser, 
    Undo, 
    Redo, 
    Trash2, 
    Download, 
    Copy,
    Palette,
    Circle,
    Minus,
    Hexagon,
    Activity,
    Spline,
    Sparkles
} from 'lucide-react';
import { Tool, ShapeType } from '@/types/annotations';
import { useState, useEffect, useRef } from 'react';

interface ToolbarProps {
    tool: Tool;
    onToolChange: (tool: Tool) => void;
    color: string;
    onColorChange: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    eraserSize: number;
    onEraserSizeChange: (size: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onDownload: () => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    selectedCount: number;
    canUndo: boolean;
    canRedo: boolean;
    selectedShapeType: ShapeType;
    onShapeTypeChange: (shapeType: ShapeType) => void;
}

const presetColors = [
    '#000000', '#ef4444', '#3b82f6', '#22c55e', 
    '#f59e0b', '#a855f7', '#ec4899', '#64748b'
];

export default function Toolbar({
    tool,
    onToolChange,
    color,
    onColorChange,
    strokeWidth,
    onStrokeWidthChange,
    eraserSize,
    onEraserSizeChange,
    onUndo,
    onRedo,
    onDelete,
    onDuplicate,
    onDownload,
    onImageUpload,
    selectedCount,
    canUndo,
    canRedo,
    selectedShapeType,
    onShapeTypeChange,
}: ToolbarProps) {
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [showShapeMenu, setShowShapeMenu] = useState(false);
    const colorMenuRef = useRef<HTMLDivElement>(null);
    const shapeMenuRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
                setShowColorMenu(false);
            }
            if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
                setShowShapeMenu(false);
            }
        };

        if (showColorMenu || showShapeMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorMenu, showShapeMenu]);
    
    const getShapeIcon = (shapeType: ShapeType) => {
        switch (shapeType) {
            case 'rectangle': return Square;
            case 'ellipse': return Circle;
            case 'line': return Minus;
            case 'polygon': return Hexagon;
            case 'polyline': return Activity;
            case 'bezier': return Spline;
            default: return Square;
        }
    };

    const shapeTypes: { type: ShapeType; icon: React.ComponentType<{ size: number }>; label: string }[] = [
        { type: 'rectangle', icon: Square, label: 'Rectangle' },
        { type: 'ellipse', icon: Circle, label: 'Ellipse' },
        { type: 'line', icon: Minus, label: 'Line' },
        { type: 'polygon', icon: Hexagon, label: 'Polygon' },
        { type: 'polyline', icon: Activity, label: 'Polyline' },
        { type: 'bezier', icon: Spline, label: 'Bezier Curve' },
    ];

    const tools = [
        { id: 'select' as Tool, icon: MousePointer, label: 'Select' },
        { id: 'brush' as Tool, icon: Pencil, label: 'Brush' },
        { id: 'shape' as Tool, icon: getShapeIcon(selectedShapeType), label: 'Shape' },
        { id: 'text' as Tool, icon: Type, label: 'Text' },
        { id: 'eraser' as Tool, icon: Eraser, label: 'Eraser' },
        { id: 'ai' as Tool, icon: Sparkles, label: 'AI Assistant' }
    ];

    const ToolIcon = ({ 
        icon: Icon, 
        active, 
        onClick, 
        label 
    }: {
        icon: React.ComponentType<{ size: number }>;
        active: boolean;
        onClick: () => void;
        label: string;
    }) => (
        <div
            onClick={onClick}
            title={label}
            className={`tool-icon ${active ? 'active' : 'inactive'}`}
        >
            <Icon size={20} />
        </div>
    );

    return (
        <div className="toolbar-container">
            {/* Single pill-shaped toolbar */}
            <div className="toolbar-pill">
                {/* Tool icons */}
                <div className="tool-icons-section">
                    {tools.map(({ id, icon, label }) => (
                        id === 'shape' ? (
                            <div key={id} className="relative" ref={shapeMenuRef}>
                                <ToolIcon
                                    icon={icon}
                                    active={tool === id}
                                    onClick={() => {
                                        if (tool === 'shape') {
                                            setShowShapeMenu(!showShapeMenu);
                                        } else {
                                            onToolChange(id);
                                        }
                                    }}
                                    label={label}
                                />
                                {showShapeMenu && tool === 'shape' && (
                                    <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999] min-w-32">
                                        {shapeTypes.map(({ type, icon: ShapeIcon, label: shapeLabel }) => (
                                            <button
                                                key={type}
                                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 ${
                                                    selectedShapeType === type ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                                                }`}
                                                onClick={() => {
                                                    onShapeTypeChange(type);
                                                    setShowShapeMenu(false);
                                                }}
                                            >
                                                <ShapeIcon size={16} />
                                                {shapeLabel}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ToolIcon
                                key={id}
                                icon={icon}
                                active={tool === id}
                                onClick={() => onToolChange(id)}
                                label={label}
                            />
                        )
                    ))}
                    <ToolIcon
                        icon={FileImage}
                        active={false}
                        onClick={() => document.getElementById('image-upload')?.click()}
                        label="Image"
                    />
                </div>

                {/* Color Menu Section */}
                <div className="toolbar-section">
                    <div className="color-controls">
                        <div 
                            className="main-color-swatch"
                            style={{ backgroundColor: color }}
                            onClick={() => setShowColorMenu(!showColorMenu)}
                        >
                            <Palette size={14} className="palette-icon" />
                        </div>
                        <div className="quick-colors">
                            {presetColors.map((presetColor) => (
                                <div
                                    key={presetColor}
                                    className={`quick-color ${color === presetColor ? 'selected' : ''}`}
                                    style={{ backgroundColor: presetColor }}
                                    onClick={() => onColorChange(presetColor)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Size Controls Section */}
                <div className="toolbar-section">
                    <div className="stroke-controls">
                        {tool === 'eraser' ? (
                            <>
                                <span className="stroke-label">{eraserSize}px</span>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    value={eraserSize}
                                    onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                    className="stroke-slider"
                                />
                            </>
                        ) : (
                            <>
                                <span className="stroke-label">{strokeWidth}px</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={strokeWidth}
                                    onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                                    className="stroke-slider"
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Action buttons */}
                <div className="action-buttons-section">
                    <div
                        className={`action-icon ${!canUndo ? 'disabled' : ''}`}
                        onClick={canUndo ? onUndo : undefined}
                        title="Undo"
                    >
                        <Undo size={18} />
                    </div>
                    <div
                        className={`action-icon ${!canRedo ? 'disabled' : ''}`}
                        onClick={canRedo ? onRedo : undefined}
                        title="Redo"
                    >
                        <Redo size={18} />
                    </div>
                    {selectedCount > 0 && (
                        <>
                            <div
                                className="action-icon"
                                onClick={onDuplicate}
                                title="Duplicate"
                            >
                                <Copy size={18} />
                            </div>
                            <div
                                className="action-icon"
                                onClick={onDelete}
                                title="Delete"
                            >
                                <Trash2 size={18} />
                            </div>
                        </>
                    )}
                    <div
                        className="action-icon"
                        onClick={onDownload}
                        title="Download"
                    >
                        <Download size={18} />
                    </div>
                </div>
            </div>

            {/* Color Menu Dropdown */}
            {showColorMenu && (
                <div ref={colorMenuRef} className="color-menu-dropdown">
                    <div className="color-grid">
                        {presetColors.map((presetColor) => (
                            <div
                                key={presetColor}
                                className={`color-option ${color === presetColor ? 'selected' : ''}`}
                                style={{ backgroundColor: presetColor }}
                                onClick={() => {
                                    onColorChange(presetColor);
                                    setShowColorMenu(false);
                                }}
                            />
                        ))}
                    </div>
                    <div className="custom-color-section">
                        <span className="custom-label">Custom:</span>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="custom-color-input"
                        />
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
            />
        </div>
    );
}