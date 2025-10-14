import { useState, useCallback } from 'react';
import { Annotation, Tool, SelectionRect, TextInput, DragState, ResizeState, ShapeType, Point, Bounds } from '@/types/annotations';

// Helper function to calculate bounding box for an annotation
export const calculateBounds = (annotation: Annotation): Bounds => {
    switch (annotation.type) {
        case 'stroke': {
            const points = annotation.points;
            if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
            
            const xs = points.filter((_, i) => i % 2 === 0);
            const ys = points.filter((_, i) => i % 2 === 1);
            
            const x = Math.min(...xs);
            const y = Math.min(...ys);
            const width = Math.max(...xs) - x;
            const height = Math.max(...ys) - y;
            
            return { x, y, width, height };
        }
        case 'text':
        case 'image':
            return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
        case 'shape': {
            if (annotation.shapeType === 'rectangle' || annotation.shapeType === 'ellipse') {
                return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
            } else {
                // For line-based shapes, calculate from points
                const points = annotation.points || [];
                if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
                
                const xs = points.filter((_, i) => i % 2 === 0);
                const ys = points.filter((_, i) => i % 2 === 1);
                
                const x = Math.min(...xs);
                const y = Math.min(...ys);
                const width = Math.max(...xs) - x;
                const height = Math.max(...ys) - y;
                
                return { x, y, width, height };
            }
        }
        default:
            return { x: 0, y: 0, width: 0, height: 0 };
    }
};

// Helper function to create annotation
const createAnnotation = (annotation: Omit<Annotation, 'isEditing' | 'isSelected'>): Annotation => {
    return {
        ...annotation,
        isEditing: false,
        isSelected: false
    } as Annotation;
};


// Helper function to get cursor type based on anchor index
const getCursorForAnchorIndex = (anchorIndex: number): string => {
    switch (anchorIndex) {
        case 0: return 'nwse-resize';   // Top-left         - diagonal resize (both directions)
        case 1: return 'ns-resize';     // Top-center       - vertical resize only
        case 2: return 'nesw-resize';   // Top-right        - diagonal resize (both directions)
        case 3: return 'ew-resize';     // Right-center     - horizontal resize only
        case 4: return 'nwse-resize';   // Bottom-right     - diagonal resize (both directions)
        case 5: return 'ns-resize';     // Bottom-center    - vertical resize only
        case 6: return 'nesw-resize';   // Bottom-left      - diagonal resize (both directions)
        case 7: return 'ew-resize';     // Left-center      - horizontal resize only
        default: return 'default';
    }
};

// Helper function to detect hover over anchor points
const getHoveredAnchorIndex = (x: number, y: number, annotation: Annotation): number | null => {
    if (!annotation.isSelected) return null;
    
    const { x: boundX, y: boundY, width, height } = calculateBounds(annotation);
    const anchorSize = 8;
    const tolerance = 12; // Hover tolerance around anchor points
    
    // Define anchor points: 8 points around the rectangle
    const anchors = [
        { x: boundX - anchorSize/2, y: boundY - anchorSize/2 }, // top-left (0)
        { x: boundX + width/2, y: boundY - anchorSize/2 }, // top-center (1)
        { x: boundX + width - anchorSize/2, y: boundY - anchorSize/2 }, // top-right (2)
        { x: boundX + width - anchorSize/2, y: boundY + height/2 }, // right-center (3)
        { x: boundX + width - anchorSize/2, y: boundY + height - anchorSize/2 }, // bottom-right (4)
        { x: boundX + width/2, y: boundY + height - anchorSize/2 }, // bottom-center (5)
        { x: boundX - anchorSize/2, y: boundY + height - anchorSize/2 }, // bottom-left (6)
        { x: boundX - anchorSize/2, y: boundY + height/2 }, // left-center (7)
    ];
    
    for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const distance = Math.sqrt(Math.pow(x - (anchor.x + anchorSize/2), 2) + Math.pow(y - (anchor.y + anchorSize/2), 2));
        if (distance <= tolerance) {
            return i;
        }
    }
    
    return null;
};

// Helper function to detect clicks on anchor points
const isAnchorPointClick = (x: number, y: number, annotation: Annotation): { isClick: boolean; anchorIndex: number | null } => {
    const anchorIndex = getHoveredAnchorIndex(x, y, annotation);
    return { isClick: anchorIndex !== null, anchorIndex };
};

// Helper function to resize annotation based on anchor point
const resizeAnnotation = (
    anchorIndex: number, 
    originalAnnotation: Annotation,
    newX: number, 
    newY: number
): Annotation => {
    const updatedAnnotation = { ...originalAnnotation };
    
    // Get original bounds from the original annotation
    const originalBounds = calculateBounds(originalAnnotation);
    
    // Calculate the unchanged anchor point coordinates
    let unchangedX: number, unchangedY: number;
    let widthRate: number, heightRate: number;
    
    switch (anchorIndex) {
        case 0: // Top-left - unchanged anchor is bottom-right
            unchangedX = originalBounds.x + originalBounds.width;
            unchangedY = originalBounds.y + originalBounds.height;
            widthRate = (unchangedX - newX) / originalBounds.width;
            heightRate = (unchangedY - newY) / originalBounds.height;
            break;
        case 1: // Top-center - unchanged anchor is bottom-left corner
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y + originalBounds.height;
            // For vertical-only resize, width stays the same
            widthRate = 1;
            heightRate = (unchangedY - newY) / originalBounds.height;
            break;
        case 2: // Top-right - unchanged anchor is bottom-left
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y + originalBounds.height;
            widthRate = (newX - unchangedX) / originalBounds.width;
            heightRate = (unchangedY - newY) / originalBounds.height;
            break;
        case 3: // Right-center - unchanged anchor is top-left corner
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y;
            // For horizontal-only resize, height stays the same
            widthRate = (newX - unchangedX) / originalBounds.width;
            heightRate = 1;
            break;
        case 4: // Bottom-right - unchanged anchor is top-left
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y;
            widthRate = (newX - unchangedX) / originalBounds.width;
            heightRate = (newY - unchangedY) / originalBounds.height;
            break;
        case 5: // Bottom-center - unchanged anchor is top-left corner
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y;
            // For vertical-only resize, width stays the same
            widthRate = 1;
            heightRate = (newY - unchangedY) / originalBounds.height;
            break;
        case 6: // Bottom-left - unchanged anchor is top-right
            unchangedX = originalBounds.x + originalBounds.width;
            unchangedY = originalBounds.y;
            widthRate = (unchangedX - newX) / originalBounds.width;
            heightRate = (newY - unchangedY) / originalBounds.height;
            break;
        case 7: // Left-center - unchanged anchor is top-right corner
            unchangedX = originalBounds.x + originalBounds.width;
            unchangedY = originalBounds.y;
            // For horizontal-only resize, height stays the same
            widthRate = (unchangedX - newX) / originalBounds.width;
            heightRate = 1;
            break;
        default:
            widthRate = 1;
            heightRate = 1;
            unchangedX = originalBounds.x;
            unchangedY = originalBounds.y;
    }
    
    
    // Update annotation based on type
    if (originalAnnotation.type === 'shape') {
        if (originalAnnotation.shapeType === 'rectangle' || originalAnnotation.shapeType === 'ellipse') {
            // Update position and size based on rates
            const newWidth = originalBounds.width * widthRate;
            const newHeight = originalBounds.height * heightRate;
            
            // Calculate new position based on unchanged corner anchor
            let newX: number, newY: number;
            
            switch (anchorIndex) {
                case 0: // Top-left - unchanged is bottom-right
                    newX = unchangedX - newWidth;
                    newY = unchangedY - newHeight;
                    break;
                case 1: // Top-center - unchanged is bottom-left
                    newX = unchangedX;
                    newY = unchangedY - newHeight;
                    break;
                case 2: // Top-right - unchanged is bottom-left
                    newX = unchangedX;
                    newY = unchangedY - newHeight;
                    break;
                case 3: // Right-center - unchanged is top-left
                    newX = unchangedX;
                    newY = unchangedY;
                    break;
                case 4: // Bottom-right - unchanged is top-left
                    newX = unchangedX;
                    newY = unchangedY;
                    break;
                case 5: // Bottom-center - unchanged is top-left
                    newX = unchangedX;
                    newY = unchangedY;
                    break;
                case 6: // Bottom-left - unchanged is top-right
                    newX = unchangedX - newWidth;
                    newY = unchangedY;
                    break;
                case 7: // Left-center - unchanged is top-right
                    newX = unchangedX - newWidth;
                    newY = unchangedY;
                    break;
                default:
                    newX = unchangedX;
                    newY = unchangedY;
            }
            
            (updatedAnnotation as any).x = newX;
            (updatedAnnotation as any).y = newY;
            (updatedAnnotation as any).width = newWidth;
            (updatedAnnotation as any).height = newHeight;
        } else if (originalAnnotation.shapeType === 'line' || originalAnnotation.shapeType === 'polygon' || originalAnnotation.shapeType === 'polyline' || originalAnnotation.shapeType === 'bezier') {
            // Scale control points using rate-based formula
            const scaledPoints: number[] = [];
            
            for (let i = 0; i < originalAnnotation.points.length; i += 2) {
                const old_px = originalAnnotation.points[i];
                const old_py = originalAnnotation.points[i + 1];
                
                // Apply rate-based transformation
                const new_px = unchangedX + (old_px - unchangedX) * widthRate;
                const new_py = unchangedY + (old_py - unchangedY) * heightRate;
                
                scaledPoints.push(new_px, new_py);
            }
            
            (updatedAnnotation as any).points = scaledPoints;
        }
    } else if (originalAnnotation.type === 'text' || originalAnnotation.type === 'image') {
        // Update position and size based on rates
        const newWidth = originalBounds.width * widthRate;
        const newHeight = originalBounds.height * heightRate;
        
        // Calculate new position based on unchanged corner anchor
        let newX: number, newY: number;
        
        switch (anchorIndex) {
            case 0: // Top-left - unchanged is bottom-right
                newX = unchangedX - newWidth;
                newY = unchangedY - newHeight;
                break;
            case 1: // Top-center - unchanged is bottom-left
                newX = unchangedX;
                newY = unchangedY - newHeight;
                break;
            case 2: // Top-right - unchanged is bottom-left
                newX = unchangedX;
                newY = unchangedY - newHeight;
                break;
            case 3: // Right-center - unchanged is top-left
                newX = unchangedX;
                newY = unchangedY;
                break;
            case 4: // Bottom-right - unchanged is top-left
                newX = unchangedX;
                newY = unchangedY;
                break;
            case 5: // Bottom-center - unchanged is top-left
                newX = unchangedX;
                newY = unchangedY;
                break;
            case 6: // Bottom-left - unchanged is top-right
                newX = unchangedX - newWidth;
                newY = unchangedY;
                break;
            case 7: // Left-center - unchanged is top-right
                newX = unchangedX - newWidth;
                newY = unchangedY;
                break;
            default:
                newX = unchangedX;
                newY = unchangedY;
        }
        
        (updatedAnnotation as any).x = newX;
        (updatedAnnotation as any).y = newY;
        (updatedAnnotation as any).width = newWidth;
        (updatedAnnotation as any).height = newHeight;
    } else if (originalAnnotation.type === 'stroke') {
        // Scale stroke points using rate-based formula
        const scaledPoints: number[] = [];
        
        for (let i = 0; i < originalAnnotation.points.length; i += 2) {
            const old_px = originalAnnotation.points[i];
            const old_py = originalAnnotation.points[i + 1];
            
            // Apply rate-based transformation
            const new_px = unchangedX + (old_px - unchangedX) * widthRate;
            const new_py = unchangedY + (old_py - unchangedY) * heightRate;
            
            scaledPoints.push(new_px, new_py);
        }
        
        (updatedAnnotation as any).points = scaledPoints;
    }
    
    return updatedAnnotation;
};

export const useDrawingState = () => {
    const [tool, setTool] = useState<Tool>('brush');
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [history, setHistory] = useState<Annotation[][]>([[]]);
    const [historyStep, setHistoryStep] = useState(0);
    const [color, setColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [eraserSize, setEraserSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<number[]>([]);
    const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
    const [textInput, setTextInput] = useState<TextInput>({
        visible: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0
    });
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startPoint: null,
        offset: { x: 0, y: 0 }
    });
    const [resizeState, setResizeState] = useState<ResizeState>({
        isResizing: false,
        startPoint: null,
        currentPoint: null,
        anchorIndex: null,
        originalAnnotation: null
    });
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [hoveredAnchorIndex, setHoveredAnchorIndex] = useState<number | null>(null);
    const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>('rectangle');
    const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
    const [editingControlPointIndex, setEditingControlPointIndex] = useState<number | null>(null);
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
    const [isDrawingLine, setIsDrawingLine] = useState(false);
    const [linePoints, setLinePoints] = useState<Point[]>([]);
    const [isDrawingBezier, setIsDrawingBezier] = useState(false);
    const [bezierPoints, setBezierPoints] = useState<Point[]>([]);
    const [aiSelectionRect, setAiSelectionRect] = useState<SelectionRect | null>(null);
    const [aiSelectionStart, setAiSelectionStart] = useState<Point | null>(null);

    const saveToHistory = useCallback((newAnnotations: Annotation[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push([...newAnnotations]);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    }, [history, historyStep]);

    // Helper function to get selected annotations
    const getSelectedAnnotations = useCallback(() => {
        return annotations.filter(ann => ann.isSelected);
    }, [annotations]);

    // Helper function to get selected annotation IDs
    const getSelectedIds = useCallback(() => {
        return annotations.filter(ann => ann.isSelected).map(ann => ann.id);
    }, [annotations]);

    // Helper function to select annotation(s)
    const selectAnnotations = useCallback((ids: string[], clearOthers = true) => {
        setAnnotations(prev => {
            const updated = prev.map(ann => {
                if (ids.includes(ann.id)) {
                    return { ...ann, isSelected: true, isEditing: ids.length === 1 };
                } else if (clearOthers) {
                    return { ...ann, isSelected: false, isEditing: false };
                }
                return ann;
            });
            return updated;
        });
    }, []);

    // Helper function to clear all selections
    const clearSelection = useCallback(() => {
        setAnnotations(prev => prev.map(ann => ({ ...ann, isSelected: false, isEditing: false })));
    }, []);

    const handleUndo = useCallback(() => {
        if (historyStep > 0) {
            setHistoryStep(historyStep - 1);
            setAnnotations(history[historyStep - 1]);
        }
    }, [historyStep, history]);

    const handleRedo = useCallback(() => {
        if (historyStep < history.length - 1) {
            setHistoryStep(historyStep + 1);
            setAnnotations(history[historyStep + 1]);
        }
    }, [historyStep, history]);

    const clearCanvas = useCallback(() => {
        setAnnotations([]);
        setCurrentPoints([]);
        setSelectionRect(null);
        setTextInput({ visible: false, x: 0, y: 0, width: 0, height: 0 });
        setHistory([[]]);
        setHistoryStep(0);
    }, []);

    const handleDelete = useCallback(() => {
        const newAnnotations = annotations.filter(ann => !ann.isSelected);
        setAnnotations(newAnnotations);
        saveToHistory(newAnnotations);
    }, [annotations, saveToHistory]);

    const handleDuplicate = useCallback(() => {
        const toDuplicate = annotations.filter(ann => ann.isSelected);
        const duplicated = toDuplicate.map(ann => {
            const newAnn = { ...ann, id: `${ann.type}_${Date.now()}_${Math.random()}` };
            if ('x' in newAnn && newAnn.x !== undefined) newAnn.x += 20;
            if ('y' in newAnn && newAnn.y !== undefined) newAnn.y += 20;
            return createAnnotation(newAnn as any);
        });
        const newAnnotations = [...annotations, ...duplicated];
        setAnnotations(newAnnotations);
        saveToHistory(newAnnotations);
    }, [annotations, saveToHistory]);

    const handleColorChange = useCallback((newColor: string) => {
        const selectedAnnotations = getSelectedAnnotations();
        if (selectedAnnotations.length > 0) {
            const newAnnotations = annotations.map(ann => 
                ann.isSelected ? { ...ann, color: newColor } : ann
            );
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
        }
        setColor(newColor);
    }, [annotations, saveToHistory, getSelectedAnnotations]);

    // AI selection functions
    const startAiSelection = useCallback((point: Point) => {
        if (tool === 'ai') {
            setAiSelectionStart(point);
            setAiSelectionRect({
                x: point.x,
                y: point.y,
                width: 0,
                height: 0
            });
        }
    }, [tool]);

    const updateAiSelection = useCallback((point: Point) => {
        if (tool === 'ai' && aiSelectionStart) {
            const rect = {
                x: Math.min(aiSelectionStart.x, point.x),
                y: Math.min(aiSelectionStart.y, point.y),
                width: Math.abs(point.x - aiSelectionStart.x),
                height: Math.abs(point.y - aiSelectionStart.y)
            };
            setAiSelectionRect(rect);
        }
    }, [tool, aiSelectionStart]);

    const endAiSelection = useCallback(() => {
        if (tool === 'ai' && aiSelectionRect && aiSelectionRect.width > 10 && aiSelectionRect.height > 10) {
            // Return the completed rect but keep it on screen (do not clear)
            const completedRect = { ...aiSelectionRect };
            // Stop dragging state but keep the visual rectangle so user can see selection
            setAiSelectionStart(null);
            return completedRect;
        }
        // If selection is too small or tool changed, clear any transient state but keep existing rect if present
        setAiSelectionStart(null);
        return null;
    }, [tool, aiSelectionRect]);

    return {
        // State
        tool,
        annotations,
        history,
        historyStep,
        color,
        strokeWidth,
        eraserSize,
        isDrawing,
        currentPoints,
        selectionRect,
        textInput,
        showColorPicker,
        dragState,
        resizeState,
        hoveredId,
        hoveredAnchorIndex,
        selectedShapeType,
        editingAnnotationId,
        editingControlPointIndex,
        isDrawingPolygon,
        polygonPoints,
        isDrawingLine,
        linePoints,
        isDrawingBezier,
        bezierPoints,
        aiSelectionRect,
        aiSelectionStart,
        
        // Setters
        setTool,
        setAnnotations,
        setColor,
        setStrokeWidth,
        setEraserSize,
        setIsDrawing,
        setCurrentPoints,
        getSelectedIds,
        selectAnnotations,
        clearSelection,
        getSelectedAnnotations,
        setSelectionRect,
        setTextInput,
        setShowColorPicker,
        setDragState,
        setResizeState,
        setHoveredId,
        setHoveredAnchorIndex,
        setSelectedShapeType,
        setEditingAnnotationId,
        setEditingControlPointIndex,
        setIsDrawingPolygon,
        setPolygonPoints,
        setIsDrawingLine,
        setLinePoints,
        setIsDrawingBezier,
        setBezierPoints,
        setAiSelectionRect,
        setAiSelectionStart,
        
        // Actions
        saveToHistory,
        handleUndo,
        handleRedo,
        clearCanvas,
        handleDelete,
        handleDuplicate,
        handleColorChange,
        createAnnotation,
        isAnchorPointClick,
        resizeAnnotation,
        getCursorForAnchorIndex,
        getHoveredAnchorIndex,
        calculateBounds,
        startAiSelection,
        updateAiSelection,
        endAiSelection,
        
        // Computed values
        canUndo: historyStep > 0,
        canRedo: historyStep < history.length - 1,
        selectedCount: getSelectedAnnotations().length
    };
};