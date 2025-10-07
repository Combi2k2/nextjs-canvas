'use client';

import { useCallback, useEffect } from 'react';
import { isPointInAnnotation, isAnnotationInRect, isAnnotationInEraserCircle } from '@/utils/geometry';

// Helper functions for control point detection
const isControlPointClick = (x: number, y: number, annotation: Annotation): boolean => {
    const threshold = 8;
    
    if (annotation.type === 'shape') {
        if (annotation.shapeType === 'line' || annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline' || annotation.shapeType === 'bezier') {
            const points = annotation.points || [];
            for (let i = 0; i < points.length; i += 2) {
                const px = points[i];
                const py = points[i + 1];
                const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
                if (dist <= threshold) {
                    return true;
                }
            }
        }
    }
    return false;
};

const getControlPointIndex = (x: number, y: number, annotation: Annotation): number | null => {
    const threshold = 8;
    
    if (annotation.type === 'shape') {
        if (annotation.shapeType === 'line' || annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline' || annotation.shapeType === 'bezier') {
            const points = annotation.points || [];
            for (let i = 0; i < points.length; i += 2) {
                const px = points[i];
                const py = points[i + 1];
                const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
                if (dist <= threshold) {
                    return i / 2; // Return point index
                }
            }
        }
    }
    return null;
};

// Helper function to detect clicks on annotation for selection (clicking on the actual annotation shape/stroke)
const isAnnotationClick = (x: number, y: number, annotation: Annotation): boolean => {
    if (annotation.type === 'shape') {
        // For all shapes, use the existing edge detection to only select when clicking near the perimeter/stroke
        return isPointInAnnotation(x, y, annotation);
    } else if (annotation.type === 'text' || annotation.type === 'image') {
        // For text and images, allow clicking anywhere inside
        return x >= annotation.x && 
               x <= annotation.x + annotation.width && 
               y >= annotation.y && 
               y <= annotation.y + annotation.height;
    } else if (annotation.type === 'stroke') {
        // For strokes, use the existing point detection
        return isPointInAnnotation(x, y, annotation);
    }
    
    return false;
};

// Helper function to detect clicks on bounding box area (for moving annotations - only when already selected)
const isBoundingBoxClick = (x: number, y: number, annotation: Annotation, calculateBounds: (ann: Annotation) => any): boolean => {
    const bounds = calculateBounds(annotation);
    const l = bounds.x, r = bounds.x + bounds.width;
    const t = bounds.y, b = bounds.y + bounds.height;

    return (l <= x && x <= r && t <= y && y <= b);
};

import { useDrawingState } from '@/hooks/useDrawingState';
import { Point, ShapeAnnotation, StrokeAnnotation, TextAnnotation, ImageAnnotation, Tool, Annotation } from '@/types/annotations';
import Canvas from './Canvas';
import Toolbar from './Toolbar';

// Helper function to create ShapeAnnotation
const createShapeAnnotation = (
    points: Point[], 
    shapeType: string, 
    color: string, 
    strokeWidth: number,
    createAnnotation: (ann: any) => Annotation
): Annotation => {
    const baseAnnotation: Omit<ShapeAnnotation, 'isEditing' | 'isSelected'> = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: Math.min(...points.map(p => p.x)),
        y: Math.min(...points.map(p => p.y)),
        width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
        height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
        color,
        strokeWidth,
        shapeType: shapeType as any,
        points: points.flatMap(p => [p.x, p.y])
    };
    return createAnnotation(baseAnnotation);
};

export default function DrawingApp() {
    const {
        tool,
        annotations,
        history,
        historyStep,
        color,
        strokeWidth,
        eraserSize,
        isDrawing,
        currentPoints,
        getSelectedIds,
        selectAnnotations,
        clearSelection,
        getSelectedAnnotations,
        createAnnotation,
        calculateBounds,
        isAnchorPointClick,
        resizeAnnotation,
        getCursorForAnchorIndex,
        getHoveredAnchorIndex,
        selectionRect,
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
        setTool,
        setAnnotations,
        setStrokeWidth,
        setEraserSize,
        setIsDrawing,
        setCurrentPoints,
        setSelectionRect,
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
        // Clear all selections and editing states when switching away from selection tool
        if (tool === 'select' && newTool !== 'select') {
            clearSelection();
        }
        
        // Handle polygon/polyline flow when switching tools
        if (isDrawingPolygon) {
            if (selectedShapeType === 'polygon') {
                // Dispose polygon flow
                setIsDrawingPolygon(false);
                setPolygonPoints([]);
            } else if (selectedShapeType === 'polyline') {
                // End polyline flow by creating the annotation
                if (polygonPoints.length >= 2) {
                    const newAnnotation = createShapeAnnotation(polygonPoints, selectedShapeType, color, strokeWidth, createAnnotation);
                    
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
                const newAnnotation = createShapeAnnotation(linePoints, 'line', color, strokeWidth, createAnnotation);
                
                setAnnotations(prev => [...prev, newAnnotation]);
                saveToHistory([...annotations, newAnnotation]);
            }
            setIsDrawingLine(false);
            setLinePoints([]);
        }
        
        // Handle bezier curve drawing flow when switching tools
        if (isDrawingBezier) {
            // End bezier flow by creating the annotation
            if (bezierPoints.length >= 4) {
                const newAnnotation = createShapeAnnotation(bezierPoints, 'bezier', color, strokeWidth, createAnnotation);
                
                setAnnotations(prev => [...prev, newAnnotation]);
                saveToHistory([...annotations, newAnnotation]);
            }
            setIsDrawingBezier(false);
            setBezierPoints([]);
        }
        
        setTool(newTool as Tool);
    }, [tool, isDrawingPolygon, selectedShapeType, polygonPoints, isDrawingLine, linePoints, isDrawingBezier, bezierPoints, color, strokeWidth, setAnnotations, saveToHistory, annotations, setTool, clearSelection]);

    const handleMouseDown = useCallback((e: { point: Point; ctrlKey?: boolean; metaKey?: boolean }) => {
        const point = e.point;
        const isMultiSelect = e.ctrlKey || e.metaKey;
        setDragState(prev => ({ ...prev, startPoint: point }));
        
        if (tool === 'select') {
            // Check if clicking on a control point of a selected annotation
            const selectedAnnotations = getSelectedAnnotations();
            if (selectedAnnotations.length === 1) {
                const selectedAnnotation = selectedAnnotations[0];
                if (selectedAnnotation && isControlPointClick(point.x, point.y, selectedAnnotation)) {
                    const controlPointIndex = getControlPointIndex(point.x, point.y, selectedAnnotation);
                    if (controlPointIndex !== null) {
                        setEditingAnnotationId(selectedAnnotation.id);
                        setEditingControlPointIndex(controlPointIndex);
                        setDragState(prev => ({ ...prev, isDragging: true, offset: { x: 0, y: 0 } }));
                        setIsDrawing(true);
                        return;
                    }
                }
            }
            
            // Check if clicking on an anchor point for resizing
            if (selectedAnnotations.length === 1 && selectedAnnotations[0].isEditing) {
                const selectedAnnotation = selectedAnnotations[0];
                const anchorClick = isAnchorPointClick(point.x, point.y, selectedAnnotation);
                if (anchorClick.isClick && anchorClick.anchorIndex !== null) {
                    console.log('anchorClick:', point.x, point.y);
                    // Create a deep copy of the annotation
                    const originalAnnotation = JSON.parse(JSON.stringify(selectedAnnotation));
                    setResizeState({
                        isResizing: true,
                        startPoint: point,
                        currentPoint: point,
                        anchorIndex: anchorClick.anchorIndex,
                        originalAnnotation: originalAnnotation
                    });
                    setIsDrawing(true);
                    return;
                }
            }
            
            // Check if clicking on a selected annotation to drag (using bounding box)
            const clickedSelected = annotations.find(ann => 
                ann.isSelected && isBoundingBoxClick(point.x, point.y, ann, calculateBounds)
            );
            
            if (clickedSelected) {
                setDragState(prev => ({ ...prev, isDragging: true, offset: { x: 0, y: 0 } }));
                setIsDrawing(true);
            } else {
                // Check if clicking on an unselected annotation to select it (using annotation shape/stroke)
                const clickedAnnotation = annotations.find(ann => 
                    !ann.isSelected && isAnnotationClick(point.x, point.y, ann)
                );
                
                if (clickedAnnotation) {
                    if (isMultiSelect) {
                        // Add to existing selection
                        const currentSelectedIds = getSelectedIds();
                        selectAnnotations([...currentSelectedIds, clickedAnnotation.id], false);
                    } else {
                        // Replace selection with clicked annotation
                        selectAnnotations([clickedAnnotation.id]);
                    }
                } else if (isMultiSelect) {
                    // Ctrl/Cmd + click on empty space - do nothing (keep current selection)
                } else {
                    // Check if clicking outside all selected annotations to deselect them
                    const clickedOnSelected = annotations.some(ann => 
                        ann.isSelected && (isAnnotationClick(point.x, point.y, ann) || isBoundingBoxClick(point.x, point.y, ann, calculateBounds))
                    );
                    
                    if (!clickedOnSelected) {
                        // Click outside all selected annotations - deselect all
                        clearSelection();
                    }
                    
                    // Start selection rectangle
                    setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 });
                    setIsDrawing(true);
                }
            }
        } else if (tool === 'brush') {
            setCurrentPoints([point.x, point.y]);
            setIsDrawing(true);
        } else if (tool === 'shape') {
            if (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') {
                if (!isDrawingPolygon) {
                    // Start polygon/polyline drawing - first click sets control_point_1
                    setIsDrawingPolygon(true);
                    setPolygonPoints([point]);
                } else {
                    // For subsequent clicks, always add a new control point at the clicked position
                    // This creates a new control point even if clicking on an existing one
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
                    const newAnnotation = createShapeAnnotation([...linePoints, point], 'line', color, strokeWidth, createAnnotation);
                    
                    setAnnotations(prev => [...prev, newAnnotation]);
                    saveToHistory([...annotations, newAnnotation]);
                    
                    // Reset line drawing state
                    setIsDrawingLine(false);
                    setLinePoints([]);
                    setIsDrawing(false);
                }
            } else if (selectedShapeType === 'bezier') {
                if (!isDrawingBezier) {
                    // Start bezier curve drawing
                    setIsDrawingBezier(true);
                    setBezierPoints([point]);
                } else {
                    // Add control point to bezier curve
                    setBezierPoints(prev => [...prev, point]);
                    
                    // Complete bezier curve when we have 3 control points
                    if (bezierPoints.length >= 2) {
                        const newAnnotation = createShapeAnnotation([...bezierPoints, point], 'bezier', color, strokeWidth, createAnnotation);
                        
                        setAnnotations(prev => [...prev, newAnnotation]);
                        saveToHistory([...annotations, newAnnotation]);
                        
                        // Reset bezier drawing state
                        setIsDrawingBezier(false);
                        setBezierPoints([]);
                    }
                }
            } else {
                // Rectangle or ellipse
                setCurrentPoints([point.x, point.y]);
                setIsDrawing(true);
            }
        } else if (tool === 'text') {
            setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 });
            setIsDrawing(true);
        } else if (tool === 'eraser') {
            // Start erasing mode
            setIsDrawing(true);
            // Also handle the initial erase on mouse down
            const eraserRadius = eraserSize / 2;
            const toRemove = annotations.find(ann => isAnnotationInEraserCircle(point.x, point.y, eraserRadius, ann));
            
            if (toRemove) {
                const newAnnotations = annotations.filter(ann => ann.id !== toRemove.id);
                setAnnotations(newAnnotations);
                saveToHistory(newAnnotations);
            }
        }
    }, [tool, selectedShapeType, isDrawingPolygon, isDrawingLine, linePoints, isDrawingBezier, bezierPoints, annotations, setDragState, setSelectionRect, setIsDrawing, setCurrentPoints, setIsDrawingPolygon, setPolygonPoints, setIsDrawingLine, setLinePoints, setIsDrawingBezier, setBezierPoints, color, strokeWidth, eraserSize, setAnnotations, saveToHistory, getSelectedAnnotations, getSelectedIds, selectAnnotations]);

    const handleDoubleClick = useCallback((e: { point: Point }) => {
        // Handle polyline double-click - creates final control point and ends the flow
        if (tool === 'shape' && selectedShapeType === 'polyline' && isDrawingPolygon) {
            // Add the double-click point as the final control point
            const finalPoints = [...polygonPoints, e.point];
            
            if (finalPoints.length >= 2) {
                const newAnnotation = createShapeAnnotation(finalPoints, selectedShapeType, color, strokeWidth, createAnnotation);
                
                setAnnotations(prev => [...prev, newAnnotation]);
                saveToHistory([...annotations, newAnnotation]);
            }
            
            setIsDrawingPolygon(false);
            setPolygonPoints([]);
        }
    }, [tool, selectedShapeType, isDrawingPolygon, polygonPoints, color, strokeWidth, setAnnotations, saveToHistory, annotations]);

    const handleVertexClick = useCallback((vertexIndex: number) => {
        // Handle polygon completion when clicking on control_point_1 (index 0) with 3+ points
        if (tool === 'shape' && isDrawingPolygon && selectedShapeType === 'polygon' && polygonPoints.length > 2 && vertexIndex === 0) {
            // Complete polygon by connecting to the first control point
            const newAnnotation = createShapeAnnotation(polygonPoints, selectedShapeType, color, strokeWidth, createAnnotation);
            
            setAnnotations(prev => [...prev, newAnnotation]);
            saveToHistory([...annotations, newAnnotation]);
            
            // End the polygon flow
            setIsDrawingPolygon(false);
            setPolygonPoints([]);
        } else if (tool === 'shape' && isDrawingPolygon && (selectedShapeType === 'polygon' || selectedShapeType === 'polyline')) {
            // For all other cases, add a new control point at the same position as the clicked vertex
            const clickedPoint = polygonPoints[vertexIndex];
            setPolygonPoints(prev => [...prev, clickedPoint]);
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
            const hovered = annotations.find(ann => isAnnotationClick(point.x, point.y, ann));
            setHoveredId(hovered ? hovered.id : null);
            
            // Check for anchor point hover on all selected and editing annotations
            let anchorHoverFound = false;
            if (hovered && hovered.isSelected && hovered.isEditing) {
                const anchorIndex = getHoveredAnchorIndex(point.x, point.y, hovered);
                if (anchorIndex !== null) {
                    setHoveredAnchorIndex(anchorIndex);
                    anchorHoverFound = true;
                }
            }
            
            // If no hover found from the main hover detection, check all selected editing annotations
            // This handles cases where the mouse is over anchor points but not the annotation itself
            if (!anchorHoverFound) {
                const selectedEditingAnnotations = annotations.filter(ann => ann.isSelected && ann.isEditing);
                for (const annotation of selectedEditingAnnotations) {
                    const anchorIndex = getHoveredAnchorIndex(point.x, point.y, annotation);
                    if (anchorIndex !== null) {
                        setHoveredAnchorIndex(anchorIndex);
                        anchorHoverFound = true;
                        break;
                    }
                }
            }
            
            if (!anchorHoverFound) {
                setHoveredAnchorIndex(null);
            }
        } else {
            setHoveredId(null);
            setHoveredAnchorIndex(null);
        }
        
        // Handle eraser tool - works even when not in drawing mode
        if (tool === 'eraser' && isDrawing) {
            const eraserRadius = eraserSize / 2;
            const toRemove = annotations.find(ann => isAnnotationInEraserCircle(point.x, point.y, eraserRadius, ann));
            
            if (toRemove) {
                const newAnnotations = annotations.filter(ann => ann.id !== toRemove.id);
                setAnnotations(newAnnotations);
                saveToHistory(newAnnotations);
            }
            return;
        }

        if (!isDrawing) return;

        // Handle resizing - real-time update during drag
        if (tool === 'select' && resizeState.isResizing && resizeState.startPoint && resizeState.anchorIndex !== null && resizeState.originalAnnotation) {
            const resizedAnnotation = resizeAnnotation(
                resizeState.anchorIndex,
                resizeState.originalAnnotation,
                point.x,
                point.y
            );
            // Update annotation with new bounds and scaled control points
            setAnnotations(prev => prev.map(ann => 
                ann.id === resizeState.originalAnnotation!.id ? resizedAnnotation : ann
            ));
            return;
        }

        if (tool === 'select' && dragState.isDragging && dragState.startPoint) {
            // Check if we're dragging a control point
            if (editingAnnotationId && editingControlPointIndex !== null) {
                const editingAnnotation = annotations.find(ann => ann.id === editingAnnotationId);
                if (editingAnnotation) {
                    const dx = point.x - dragState.startPoint.x - dragState.offset.x;
                    const dy = point.y - dragState.startPoint.y - dragState.offset.y;
                    
                    const newAnnotations = annotations.map(ann => {
                        if (ann.id !== editingAnnotationId) return ann;
                        
                        const updatedAnn = { ...ann };
                        
                        if (ann.type === 'shape' && (ann.shapeType === 'line' || ann.shapeType === 'polygon' || ann.shapeType === 'polyline' || ann.shapeType === 'bezier')) {
                            const points = [...(ann.points || [])];
                            const pointIndex = editingControlPointIndex * 2;
                            if (pointIndex < points.length - 1) {
                                points[pointIndex] = points[pointIndex] + dx;
                                points[pointIndex + 1] = points[pointIndex + 1] + dy;
                                (updatedAnn as any).points = points;
                            }
                        } else if (ann.type === 'stroke') {
                            const points = [...ann.points];
                            const pointIndex = editingControlPointIndex * 2;
                            if (pointIndex < points.length - 1) {
                                points[pointIndex] = points[pointIndex] + dx;
                                points[pointIndex + 1] = points[pointIndex + 1] + dy;
                                (updatedAnn as any).points = points;
                            }
                        }
                        
                        // Return the updated annotation
                        return updatedAnn;
                    });
                    
                    setAnnotations(newAnnotations);
                    setDragState(prev => ({ ...prev, offset: { x: point.x - dragState.startPoint!.x, y: point.y - dragState.startPoint!.y } }));
                    return;
                }
            }
            
            // Dragging selected annotations
            const dx = point.x - dragState.startPoint.x - dragState.offset.x;
            const dy = point.y - dragState.startPoint.y - dragState.offset.y;
            setDragState(prev => ({ ...prev, offset: { x: point.x - dragState.startPoint!.x, y: point.y - dragState.startPoint!.y } }));
            
            const newAnnotations = annotations.map(ann => {
                if (!ann.isSelected) return ann;
                
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
                    if (ann.shapeType === 'line' || ann.shapeType === 'polygon' || ann.shapeType === 'polyline' || ann.shapeType === 'bezier') {
                        (updatedAnn as any).points = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy); // eslint-disable-line @typescript-eslint/no-explicit-any
                    }
                }
                
                // Return the updated annotation
                return updatedAnn;
            });
            
            setAnnotations(newAnnotations);
        } else if (tool === 'brush') {
            setCurrentPoints(prev => [...prev, point.x, point.y]);
        } else if (tool === 'shape') {
            if (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') {
                // Don't update current points for polygon/polyline - they're handled in mouse down
                return;
            } else if (selectedShapeType === 'bezier') {
                // Don't update current points for bezier - they're handled in mouse down
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
    }, [isDrawing, tool, dragState, annotations, selectionRect, setHoveredId, setHoveredAnchorIndex, setDragState, setAnnotations, setCurrentPoints, setSelectionRect, eraserSize, saveToHistory, isAnnotationClick, getHoveredAnchorIndex]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawing) return;
        
        // Handle resize completion - just save to history and clear state
        if (resizeState.isResizing) {
            saveToHistory(annotations);
            setResizeState({
                isResizing: false,
                startPoint: null,
                currentPoint: null,
                anchorIndex: null,
                originalAnnotation: null
            });
        }
        
        // Save history if we were dragging
        if (dragState.isDragging) {
            saveToHistory(annotations);
            setDragState(prev => ({ ...prev, isDragging: false, offset: { x: 0, y: 0 } }));
        }
        
        // Clear editing state
        setEditingAnnotationId(null);
        setEditingControlPointIndex(null);
        
        setIsDrawing(false);

        if (tool === 'brush' && currentPoints.length > 0) {
            const baseAnnotation: Omit<StrokeAnnotation, 'isEditing' | 'isSelected' | 'bound'> = {
                id: `stroke-${Date.now()}`,
                type: 'stroke',
                points: currentPoints,
                color,
                strokeWidth
            };
            const newAnnotation = createAnnotation(baseAnnotation);
            const newAnnotations = [...annotations, newAnnotation];
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
            setCurrentPoints([]);
        } else if (tool === 'shape' && currentPoints.length === 4 && selectedShapeType !== 'polygon' && selectedShapeType !== 'polyline' && selectedShapeType !== 'bezier') {
            // Create rectangle, ellipse, or line (drag-and-release mode)
            const x1 = currentPoints[0];
            const y1 = currentPoints[1];
            const x2 = currentPoints[2];
            const y2 = currentPoints[3];
            
            const baseAnnotation: Omit<ShapeAnnotation, 'isEditing' | 'isSelected' | 'bound'> = {
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
            const newAnnotation = createAnnotation(baseAnnotation);
            
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
            selectAnnotations(selected);
            setSelectionRect(null);
        } else if (tool === 'text' && selectionRect) {
            // Create text annotation and immediately start editing
            const baseText: Omit<TextAnnotation, 'isEditing' | 'isSelected' | 'bound'> = {
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
            const newText = createAnnotation(baseText);
            const newAnnotations = [...annotations, newText];
            setAnnotations(newAnnotations);
            saveToHistory(newAnnotations);
            setSelectionRect(null);
            
            // The text will be automatically put into editing mode by the Canvas component
        }
        setDragState(prev => ({ ...prev, startPoint: null }));
    }, [isDrawing, dragState, resizeState, tool, currentPoints, color, strokeWidth, annotations, selectionRect, saveToHistory, setAnnotations, setCurrentPoints, setSelectionRect, setDragState, setResizeState, setIsDrawing, isDrawingBezier, setBezierPoints, selectAnnotations]);



    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const baseImage: Omit<ImageAnnotation, 'isEditing' | 'isSelected' | 'bound'> = {
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
                    const newImage = createAnnotation(baseImage);
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
                    eraserSize={eraserSize}
                    onEraserSizeChange={setEraserSize}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onDownload={handleDownload}
                    onImageUpload={handleImageUpload}
                    selectedCount={getSelectedAnnotations().length}
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
                                    const newAnnotation = createShapeAnnotation(polygonPoints, selectedShapeType, color, strokeWidth, createAnnotation);
                                    
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
                                const newAnnotation = createShapeAnnotation(linePoints, 'line', color, strokeWidth, createAnnotation);
                                
                                setAnnotations(prev => [...prev, newAnnotation]);
                                saveToHistory([...annotations, newAnnotation]);
                            }
                            setIsDrawingLine(false);
                            setLinePoints([]);
                        }
                        
                        // Handle bezier curve drawing flow when switching shape types
                        if (isDrawingBezier) {
                            // End bezier flow by creating the annotation
                            if (bezierPoints.length >= 4) {
                                const newAnnotation = createShapeAnnotation(bezierPoints, 'bezier', color, strokeWidth, createAnnotation);
                                
                                setAnnotations(prev => [...prev, newAnnotation]);
                                saveToHistory([...annotations, newAnnotation]);
                            }
                            setIsDrawingBezier(false);
                            setBezierPoints([]);
                        }
                        
                        setSelectedShapeType(newShapeType);
                    }}
                />
            </div>

            <div className="flex-1 flex items-center justify-center p-6 relative z-0">
                <div className="w-full h-full max-w-7xl canvas-gradient-overlay">
                    <Canvas
                        annotations={annotations}
                        getSelectedIds={getSelectedIds}
                        hoveredAnchorIndex={hoveredAnchorIndex}
                        getCursorForAnchorIndex={getCursorForAnchorIndex}
                        hoveredId={hoveredId}
                        tool={tool}
                        color={color}
                        strokeWidth={strokeWidth}
                        eraserSize={eraserSize}
                        currentPoints={currentPoints}
                        selectionRect={selectionRect}
                        selectedShapeType={selectedShapeType}
                        editingAnnotationId={editingAnnotationId}
                        editingControlPointIndex={editingControlPointIndex}
                        isDrawingPolygon={isDrawingPolygon}
                        polygonPoints={polygonPoints}
                        isDrawingLine={isDrawingLine}
                        linePoints={linePoints}
                        isDrawingBezier={isDrawingBezier}
                        bezierPoints={bezierPoints}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                        onVertexClick={handleVertexClick}
                        onTextEdit={handleTextEdit}
                        onTextEditCancel={() => {}}
                    />
                </div>
            </div>
        </div>
    );
}