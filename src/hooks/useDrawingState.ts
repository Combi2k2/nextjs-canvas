import { useState, useCallback } from 'react';
import { Annotation, Tool, SelectionRect, TextInput, DragState, ShapeType, Point } from '@/types/annotations';

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
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>('rectangle');
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
    const [isDrawingLine, setIsDrawingLine] = useState(false);
    const [linePoints, setLinePoints] = useState<Point[]>([]);
    const [isDrawingBezier, setIsDrawingBezier] = useState(false);
    const [bezierPoints, setBezierPoints] = useState<Point[]>([]);

    const saveToHistory = useCallback((newAnnotations: Annotation[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push([...newAnnotations]);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    }, [history, historyStep]);

    const handleUndo = useCallback(() => {
        if (historyStep > 0) {
            setHistoryStep(historyStep - 1);
            setAnnotations(history[historyStep - 1]);
            setSelectedIds([]);
        }
    }, [historyStep, history]);

    const handleRedo = useCallback(() => {
        if (historyStep < history.length - 1) {
            setHistoryStep(historyStep + 1);
            setAnnotations(history[historyStep + 1]);
            setSelectedIds([]);
        }
    }, [historyStep, history]);

    const clearCanvas = useCallback(() => {
        setAnnotations([]);
        setSelectedIds([]);
        setCurrentPoints([]);
        setSelectionRect(null);
        setTextInput({ visible: false, x: 0, y: 0, width: 0, height: 0 });
        setHistory([[]]);
        setHistoryStep(0);
    }, []);

    const handleDelete = useCallback(() => {
        const newAnnotations = annotations.filter(ann => !selectedIds.includes(ann.id));
        setAnnotations(newAnnotations);
        saveToHistory(newAnnotations);
        setSelectedIds([]);
    }, [annotations, selectedIds, saveToHistory]);

    const handleDuplicate = useCallback(() => {
        const toDuplicate = annotations.filter(ann => selectedIds.includes(ann.id));
        const duplicated = toDuplicate.map(ann => {
            const newAnn = { ...ann, id: `${ann.type}_${Date.now()}_${Math.random()}` };
            if ('x' in newAnn && newAnn.x !== undefined) newAnn.x += 20;
            if ('y' in newAnn && newAnn.y !== undefined) newAnn.y += 20;
            return newAnn;
        });
        const newAnnotations = [...annotations, ...duplicated];
        setAnnotations(newAnnotations);
        saveToHistory(newAnnotations);
    }, [annotations, selectedIds, saveToHistory]);

    const handleColorChange = useCallback((newColor: string) => {
        if (selectedIds.length > 0) {
            const newAnnotations = annotations.map(ann => 
                selectedIds.includes(ann.id) ? { ...ann, color: newColor } : ann
            );
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
        }
        setColor(newColor);
    }, [selectedIds, annotations, saveToHistory]);

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
        selectedIds,
        selectionRect,
        textInput,
        showColorPicker,
        dragState,
        hoveredId,
        selectedShapeType,
        isDrawingPolygon,
        polygonPoints,
        isDrawingLine,
        linePoints,
        isDrawingBezier,
        bezierPoints,
        
        // Setters
        setTool,
        setAnnotations,
        setColor,
        setStrokeWidth,
        setEraserSize,
        setIsDrawing,
        setCurrentPoints,
        setSelectedIds,
        setSelectionRect,
        setTextInput,
        setShowColorPicker,
        setDragState,
        setHoveredId,
        setSelectedShapeType,
        setIsDrawingPolygon,
        setPolygonPoints,
        setIsDrawingLine,
        setLinePoints,
        setIsDrawingBezier,
        setBezierPoints,
        
        // Actions
        saveToHistory,
        handleUndo,
        handleRedo,
        clearCanvas,
        handleDelete,
        handleDuplicate,
        handleColorChange,
        
        // Computed values
        canUndo: historyStep > 0,
        canRedo: historyStep < history.length - 1
    };
};