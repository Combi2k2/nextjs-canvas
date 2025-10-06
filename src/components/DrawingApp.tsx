'use client';

import { useCallback, useEffect } from 'react';
import { isPointInAnnotation, isAnnotationInRect } from '@/utils/geometry';
import { useDrawingState } from '@/hooks/useDrawingState';
import { Point, ShapeAnnotation, StrokeAnnotation, TextAnnotation, ImageAnnotation } from '@/types/annotations';
import Canvas from './Canvas';
import Toolbar from './Toolbar';

export default function DrawingApp() {
    const {
        tool,
        annotations,
        history,
        historyStep,
        color,
        strokeWidth,
        isDrawing,
        currentPoints,
        selectedIds,
        selectionRect,
        dragState,
        hoveredId,
        selectedShapeType,
        isDrawingPolygon,
        polygonPoints,
        isDrawingLine,
        linePoints,
        setTool,
        setAnnotations,
        setStrokeWidth,
        setIsDrawing,
        setCurrentPoints,
        setSelectedIds,
        setSelectionRect,
        setDragState,
        setHoveredId,
        setSelectedShapeType,
        setIsDrawingPolygon,
        setPolygonPoints,
        setIsDrawingLine,
        setLinePoints,
        saveToHistory,
        handleUndo,
        handleRedo,
        handleDelete,
        handleDuplicate,
        handleColorChange,
        canUndo,
        canRedo
    } = useDrawingState();

    const handleToolChange = useCallback((newTool: string) => {
        // Handle polygon/polyline flow when switching tools
        if (isDrawingPolygon) {
            if (selectedShapeType === 'polygon') {
                // Dispose polygon flow
                setIsDrawingPolygon(false);
                setPolygonPoints([]);
            } else if (selectedShapeType === 'polyline') {
                // End polyline flow by creating the annotation
                if (polygonPoints.length >= 2) {
                    const points = polygonPoints.flatMap(p => [p.x, p.y]);
                    const newAnnotation: ShapeAnnotation = {
                        id: `shape-${Date.now()}`,
                        type: 'shape',
                        x: Math.min(...polygonPoints.map(p => p.x)),
                        y: Math.min(...polygonPoints.map(p => p.y)),
                        width: Math.max(...polygonPoints.map(p => p.x)) - Math.min(...polygonPoints.map(p => p.x)),
                        height: Math.max(...polygonPoints.map(p => p.y)) - Math.min(...polygonPoints.map(p => p.y)),
                        color,
                        strokeWidth,
                        shapeType: selectedShapeType,
                        points
                    };
                    
                    setAnnotations(prev => [...prev, newAnnotation]);
                    saveToHistory([...annotations, newAnnotation]);
                }
                setIsDrawingPolygon(false);
                setPolygonPoints([]);
            }
        }
        
        // Handle line drawing flow when switching tools
        if (isDrawingLine) {
            // End line flow by creating the annotation
            if (linePoints.length >= 2) {
                const points = linePoints.flatMap(p => [p.x, p.y]);
                const newAnnotation: ShapeAnnotation = {
                    id: `shape-${Date.now()}`,
                    type: 'shape',
                    x: Math.min(...linePoints.map(p => p.x)),
                    y: Math.min(...linePoints.map(p => p.y)),
                    width: Math.max(...linePoints.map(p => p.x)) - Math.min(...linePoints.map(p => p.x)),
                    height: Math.max(...linePoints.map(p => p.y)) - Math.min(...linePoints.map(p => p.y)),
                    color,
                    strokeWidth,
                    shapeType: 'line',
                    points
                };
                
                setAnnotations(prev => [...prev, newAnnotation]);
                saveToHistory([...annotations, newAnnotation]);
            }
            setIsDrawingLine(false);
            setLinePoints([]);
        }
        
        setTool(newTool as any);
    }, [isDrawingPolygon, selectedShapeType, polygonPoints, isDrawingLine, linePoints, color, strokeWidth, setAnnotations, saveToHistory, annotations, setTool]);

    const handleMouseDown = useCallback((e: { point: Point }) => {
        const point = e.point;
        setDragState(prev => ({ ...prev, startPoint: point }));
        
        if (tool === 'select') {
            // Check if clicking on a selected annotation to drag
            const clickedSelected = annotations.find(ann => 
                selectedIds.includes(ann.id) && isPointInAnnotation(point.x, point.y, ann)
            );
            
            if (clickedSelected) {
                setDragState(prev => ({ ...prev, isDragging: true, offset: { x: 0, y: 0 } }));
            } else {
                setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 });
            }
            setIsDrawing(true);
        } else if (tool === 'brush') {
            setCurrentPoints([point.x, point.y]);
            setIsDrawing(true);
        } else if (tool === 'shape') {
            if (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') {
                if (!isDrawingPolygon) {
                    // Start polygon/polyline
                    setIsDrawingPolygon(true);
                    setPolygonPoints([point]);
                } else {
                    // Add point to polygon/polyline
                    setPolygonPoints(prev => [...prev, point]);
                }
            } else if (selectedShapeType === 'line') {
                if (!isDrawingLine) {
                    // Start line drawing (both click-to-click and drag-and-release)
                    setIsDrawingLine(true);
                    setLinePoints([point]);
                    // Also set currentPoints for drag-and-release mode
                    setCurrentPoints([point.x, point.y]);
                    setIsDrawing(true);
                } else {
                    // Complete line drawing (click-to-click mode)
                    setLinePoints(prev => [...prev, point]);
                    // Create line annotation
                    const points = [...linePoints, point].flatMap(p => [p.x, p.y]);
                    const newAnnotation: ShapeAnnotation = {
                        id: `shape-${Date.now()}`,
                        type: 'shape',
                        x: Math.min(...[...linePoints, point].map(p => p.x)),
                        y: Math.min(...[...linePoints, point].map(p => p.y)),
                        width: Math.max(...[...linePoints, point].map(p => p.x)) - Math.min(...[...linePoints, point].map(p => p.x)),
                        height: Math.max(...[...linePoints, point].map(p => p.y)) - Math.min(...[...linePoints, point].map(p => p.y)),
                        color,
                        strokeWidth,
                        shapeType: 'line',
                        points
                    };
                    
                    setAnnotations(prev => [...prev, newAnnotation]);
                    saveToHistory([...annotations, newAnnotation]);
                    // Reset line drawing state
                    setIsDrawingLine(false);
                    setLinePoints([]);
                    setIsDrawing(false);
                }
            } else {
                // Rectangle or ellipse
                setCurrentPoints([point.x, point.y]);
                setIsDrawing(true);
            }
        } else if (tool === 'text') {
            setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 });
            setIsDrawing(true);
        }
    }, [tool, selectedShapeType, isDrawingPolygon, isDrawingLine, linePoints, annotations, selectedIds, setDragState, setSelectionRect, setIsDrawing, setCurrentPoints, setIsDrawingPolygon, setPolygonPoints, setIsDrawingLine, setLinePoints, color, strokeWidth, setAnnotations, saveToHistory]);

    const handleDoubleClick = useCallback((e: { point: Point }) => {
        if (tool === 'shape' && (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') && isDrawingPolygon) {
            // End polygon/polyline drawing
            if (polygonPoints.length >= 2) {
                const points = polygonPoints.flatMap(p => [p.x, p.y]);
                const newAnnotation: ShapeAnnotation = {
                    id: `shape-${Date.now()}`,
                    type: 'shape',
                    x: Math.min(...polygonPoints.map(p => p.x)),
                    y: Math.min(...polygonPoints.map(p => p.y)),
                    width: Math.max(...polygonPoints.map(p => p.x)) - Math.min(...polygonPoints.map(p => p.x)),
                    height: Math.max(...polygonPoints.map(p => p.y)) - Math.min(...polygonPoints.map(p => p.y)),
                    color,
                    strokeWidth,
                    shapeType: selectedShapeType,
                    points
                };
                
                setAnnotations(prev => [...prev, newAnnotation]);
                saveToHistory([...annotations, newAnnotation]);
            }
            
            setIsDrawingPolygon(false);
            setPolygonPoints([]);
        }
    }, [tool, selectedShapeType, isDrawingPolygon, polygonPoints, color, strokeWidth, setAnnotations, saveToHistory, annotations]);

    const handleVertexClick = useCallback((vertexIndex: number) => {
        if (tool === 'shape' && isDrawingPolygon && polygonPoints.length > 0) {
            // Connect to the clicked vertex and end the polygon/polyline flow
            const points = polygonPoints.flatMap(p => [p.x, p.y]);
            
            // Add the clicked vertex to complete the shape
            const clickedVertex = polygonPoints[vertexIndex];
            points.push(clickedVertex.x, clickedVertex.y);
            
            const newAnnotation: ShapeAnnotation = {
                id: `shape-${Date.now()}`,
                type: 'shape',
                x: Math.min(...polygonPoints.map(p => p.x)),
                y: Math.min(...polygonPoints.map(p => p.y)),
                width: Math.max(...polygonPoints.map(p => p.x)) - Math.min(...polygonPoints.map(p => p.x)),
                height: Math.max(...polygonPoints.map(p => p.y)) - Math.min(...polygonPoints.map(p => p.y)),
                color,
                strokeWidth,
                shapeType: selectedShapeType,
                points
            };
            
            setAnnotations(prev => [...prev, newAnnotation]);
            saveToHistory([...annotations, newAnnotation]);
            
            // End the polygon/polyline flow
            setIsDrawingPolygon(false);
            setPolygonPoints([]);
        }
    }, [tool, isDrawingPolygon, polygonPoints, color, strokeWidth, selectedShapeType, setAnnotations, saveToHistory, annotations]);

    const handleTextEdit = useCallback((annotationId: string, newText: string) => {
        setAnnotations(prev => prev.map(ann => 
            ann.id === annotationId && ann.type === 'text' 
                ? { ...ann, text: newText }
                : ann
        ));
        saveToHistory(annotations.map(ann => 
            ann.id === annotationId && ann.type === 'text' 
                ? { ...ann, text: newText }
                : ann
        ));
    }, [setAnnotations, saveToHistory, annotations]);

    const handleTextEditCancel = useCallback(() => {
        // No action needed for cancel - the Canvas will handle state reset
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    // Ctrl/Cmd + Z for undo
                    e.preventDefault();
                    if (canUndo) {
                        handleUndo();
                    }
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
                    e.preventDefault();
                    if (canRedo) {
                        handleRedo();
                    }
                }
            }
        };

        // Add event listener
        document.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [canUndo, canRedo, handleUndo, handleRedo]);

    const handleMouseMove = useCallback((e: { point: Point; shiftKey?: boolean }) => {
        const point = e.point;
        
        // Check hover only when selection tool is active
        if (tool === 'select') {
            const hovered = annotations.find(ann => isPointInAnnotation(point.x, point.y, ann));
            setHoveredId(hovered ? hovered.id : null);
        } else {
            setHoveredId(null);
        }
        
        if (!isDrawing) return;

        if (tool === 'select' && dragState.isDragging && dragState.startPoint) {
            // Dragging selected annotations
            const dx = point.x - dragState.startPoint.x - dragState.offset.x;
            const dy = point.y - dragState.startPoint.y - dragState.offset.y;
            setDragState(prev => ({ ...prev, offset: { x: point.x - dragState.startPoint!.x, y: point.y - dragState.startPoint!.y } }));
            
            const newAnnotations = annotations.map(ann => {
                if (!selectedIds.includes(ann.id)) return ann;
                
                const updatedAnn = { ...ann };
                
                if (ann.type === 'stroke') {
                    (updatedAnn as any).points = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy); // eslint-disable-line @typescript-eslint/no-explicit-any
                } else if (ann.type === 'text' || ann.type === 'image') {
                    (updatedAnn as any).x = ann.x + dx; // eslint-disable-line @typescript-eslint/no-explicit-any
                    (updatedAnn as any).y = ann.y + dy; // eslint-disable-line @typescript-eslint/no-explicit-any
                } else if (ann.type === 'shape') {
                    // Update shape position
                    (updatedAnn as any).x = ann.x + dx; // eslint-disable-line @typescript-eslint/no-explicit-any
                    (updatedAnn as any).y = ann.y + dy; // eslint-disable-line @typescript-eslint/no-explicit-any
                    
                    // Update points for line-based shapes
                    if (ann.shapeType === 'line' || ann.shapeType === 'polygon' || ann.shapeType === 'polyline') {
                        (updatedAnn as any).points = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy); // eslint-disable-line @typescript-eslint/no-explicit-any
                    }
                }
                
                return updatedAnn;
            });
            
            setAnnotations(newAnnotations);
        } else if (tool === 'brush') {
            setCurrentPoints(prev => [...prev, point.x, point.y]);
        } else if (tool === 'shape') {
            if (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') {
                // Don't update current points for polygon/polyline - they're handled in mouse down
                return;
            } else {
                // Update the second point for rectangle, ellipse, line
                if (currentPoints.length >= 2) {
                    let x2 = point.x;
                    let y2 = point.y;
                    
                    // Apply Shift key constraints for perfect shapes
                    if (e.shiftKey) {
                        const x1 = currentPoints[0];
                        const y1 = currentPoints[1];
                        
                        if (selectedShapeType === 'rectangle') {
                            // Make perfect square
                            const dx = Math.abs(x2 - x1);
                            const dy = Math.abs(y2 - y1);
                            const size = Math.max(dx, dy);
                            
                            x2 = x1 + (x2 > x1 ? size : -size);
                            y2 = y1 + (y2 > y1 ? size : -size);
                        } else if (selectedShapeType === 'ellipse') {
                            // Make perfect circle (square bounding box)
                            const dx = Math.abs(x2 - x1);
                            const dy = Math.abs(y2 - y1);
                            const size = Math.max(dx, dy);
                            
                            x2 = x1 + (x2 > x1 ? size : -size);
                            y2 = y1 + (y2 > y1 ? size : -size);
                        } else if (selectedShapeType === 'line') {
                            // Constrain to 45-degree angles
                            const dx = x2 - x1;
                            const dy = y2 - y1;
                            const angle = Math.atan2(dy, dx);
                            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            x2 = x1 + Math.cos(snapAngle) * distance;
                            y2 = y1 + Math.sin(snapAngle) * distance;
                        }
                    }
                    
                    setCurrentPoints([currentPoints[0], currentPoints[1], x2, y2]);
                }
            }
        } else if (tool === 'select' || tool === 'text') {
            if (selectionRect) {
                const width = point.x - selectionRect.x;
                const height = point.y - selectionRect.y;
                setSelectionRect({ ...selectionRect, width, height });
            }
        }
    }, [isDrawing, tool, dragState, annotations, selectedIds, selectionRect, setHoveredId, setDragState, setAnnotations, setCurrentPoints, setSelectionRect]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawing) return;
        
        // Save history if we were dragging
        if (dragState.isDragging) {
            saveToHistory(annotations);
            setDragState(prev => ({ ...prev, isDragging: false, offset: { x: 0, y: 0 } }));
        }
        
        setIsDrawing(false);

        if (tool === 'brush' && currentPoints.length > 0) {
            const newAnnotation: StrokeAnnotation = {
                id: `stroke-${Date.now()}`,
                type: 'stroke',
                points: currentPoints,
                color,
                strokeWidth
            };
            const newAnnotations = [...annotations, newAnnotation];
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
            setCurrentPoints([]);
        } else if (tool === 'shape' && currentPoints.length === 4 && selectedShapeType !== 'polygon' && selectedShapeType !== 'polyline') {
            // Create rectangle, ellipse, or line (drag-and-release mode)
            const x1 = currentPoints[0];
            const y1 = currentPoints[1];
            const x2 = currentPoints[2];
            const y2 = currentPoints[3];
            
            const newAnnotation: ShapeAnnotation = {
                id: `shape-${Date.now()}`,
                type: 'shape',
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
                color,
                strokeWidth,
                shapeType: selectedShapeType,
                points: [x1, y1, x2, y2]
            };
            
            const newAnnotations = [...annotations, newAnnotation];
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
            setCurrentPoints([]);
            
            // Reset line drawing state if it was active
            if (isDrawingLine) {
                setIsDrawingLine(false);
                setLinePoints([]);
            }
        } else if (tool === 'select' && selectionRect) {
            const selected = annotations.filter(ann => isAnnotationInRect(ann, selectionRect)).map(ann => ann.id);
            setSelectedIds(selected);
            setSelectionRect(null);
        } else if (tool === 'text' && selectionRect) {
            // Create text annotation and immediately start editing
            const newText: TextAnnotation = {
                id: `text-${Date.now()}`,
                type: 'text',
                text: '',
                x: selectionRect.x,
                y: selectionRect.y,
                color,
                strokeWidth: 0,
                fontSize: 24,
                width: Math.max(Math.abs(selectionRect.width), 200),
                height: Math.max(Math.abs(selectionRect.height), 50)
            };
            const newAnnotations = [...annotations, newText];
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
            setSelectionRect(null);
            
            // The text will be automatically put into editing mode by the Canvas component
        }
        setDragState(prev => ({ ...prev, startPoint: null }));
    }, [isDrawing, dragState, tool, currentPoints, color, strokeWidth, annotations, selectionRect, saveToHistory, setAnnotations, setCurrentPoints, setSelectedIds, setSelectionRect, setDragState, setIsDrawing]);

    const handleErase = useCallback((e: { point: Point }) => {
        const point = e.point;
        const toRemove = annotations.find(ann => isPointInAnnotation(point.x, point.y, ann));
        
        if (toRemove) {
            const newAnnotations = annotations.filter(ann => ann.id !== toRemove.id);
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
        }
    }, [annotations, saveToHistory, setAnnotations]);


    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const newImage: ImageAnnotation = {
                        id: `image-${Date.now()}`,
                        type: 'image',
                        image: img,
                        x: 100,
                        y: 100,
                        width: img.width / 2,
                        height: img.height / 2,
                        color: '#000000',
                        strokeWidth: 0
                    };
                    const newAnnotations = [...annotations, newImage];
                    setAnnotations(newAnnotations);
                    saveToHistory(newAnnotations);
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }, [annotations, saveToHistory, setAnnotations]);

    const handleDownload = useCallback(() => {
        // This would need to be implemented with a canvas export function
        // TODO: Implement download functionality
    }, []);

    return (
        <div className="w-full min-h-screen app-background flex flex-col">
            <div className="relative z-50">
                <Toolbar
                    tool={tool}
                    onToolChange={handleToolChange}
                    color={color}
                    onColorChange={handleColorChange}
                    strokeWidth={strokeWidth}
                    onStrokeWidthChange={setStrokeWidth}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onDownload={handleDownload}
                    onImageUpload={handleImageUpload}
                    selectedCount={selectedIds.length}
                    canUndo={historyStep > 0}
                    canRedo={historyStep < history.length - 1}
                    selectedShapeType={selectedShapeType}
                    onShapeTypeChange={(newShapeType) => {
                        // Handle polygon/polyline flow when switching shape types
                        if (isDrawingPolygon) {
                            if (selectedShapeType === 'polygon') {
                                // Dispose polygon flow
                                setIsDrawingPolygon(false);
                                setPolygonPoints([]);
                            } else if (selectedShapeType === 'polyline') {
                                // End polyline flow by creating the annotation
                                if (polygonPoints.length >= 2) {
                                    const points = polygonPoints.flatMap(p => [p.x, p.y]);
                                    const newAnnotation: ShapeAnnotation = {
                                        id: `shape-${Date.now()}`,
                                        type: 'shape',
                                        x: Math.min(...polygonPoints.map(p => p.x)),
                                        y: Math.min(...polygonPoints.map(p => p.y)),
                                        width: Math.max(...polygonPoints.map(p => p.x)) - Math.min(...polygonPoints.map(p => p.x)),
                                        height: Math.max(...polygonPoints.map(p => p.y)) - Math.min(...polygonPoints.map(p => p.y)),
                                        color,
                                        strokeWidth,
                                        shapeType: selectedShapeType,
                                        points
                                    };
                                    
                                    setAnnotations(prev => [...prev, newAnnotation]);
                                    saveToHistory([...annotations, newAnnotation]);
                                }
                                setIsDrawingPolygon(false);
                                setPolygonPoints([]);
                            }
                        }
                        
                        // Handle line drawing flow when switching shape types
                        if (isDrawingLine) {
                            // End line flow by creating the annotation
                            if (linePoints.length >= 2) {
                                const points = linePoints.flatMap(p => [p.x, p.y]);
                                const newAnnotation: ShapeAnnotation = {
                                    id: `shape-${Date.now()}`,
                                    type: 'shape',
                                    x: Math.min(...linePoints.map(p => p.x)),
                                    y: Math.min(...linePoints.map(p => p.y)),
                                    width: Math.max(...linePoints.map(p => p.x)) - Math.min(...linePoints.map(p => p.x)),
                                    height: Math.max(...linePoints.map(p => p.y)) - Math.min(...linePoints.map(p => p.y)),
                                    color,
                                    strokeWidth,
                                    shapeType: 'line',
                                    points
                                };
                                
                                setAnnotations(prev => [...prev, newAnnotation]);
                                saveToHistory([...annotations, newAnnotation]);
                            }
                            setIsDrawingLine(false);
                            setLinePoints([]);
                        }
                        
                        setSelectedShapeType(newShapeType);
                    }}
                />
            </div>

            <div className="flex-1 flex items-center justify-center p-6 relative z-0">
                <div className="w-full h-full max-w-7xl canvas-gradient-overlay">
                    <Canvas
                        annotations={annotations}
                        selectedIds={selectedIds}
                        hoveredId={hoveredId}
                        tool={tool}
                        color={color}
                        strokeWidth={strokeWidth}
                        currentPoints={currentPoints}
                        selectionRect={selectionRect}
                        selectedShapeType={selectedShapeType}
                        isDrawingPolygon={isDrawingPolygon}
                        polygonPoints={polygonPoints}
                        isDrawingLine={isDrawingLine}
                        linePoints={linePoints}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                        onErase={handleErase}
                        onVertexClick={handleVertexClick}
                        onTextEdit={handleTextEdit}
                        onTextEditCancel={handleTextEditCancel}
                    />
                </div>
            </div>
        </div>
    );
}