'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import React from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Image as KonvaImage, Ellipse, Group, Path } from 'react-konva';
import Konva from 'konva';
import { Annotation, Point, ShapeType, Bounds } from '@/types/annotations';
import { calculateBounds } from '@/hooks/useDrawingState';

// Helper function to create SVG path for 3-point bezier curve
const createBezierPath = (points: Point[]): string => {
    if (points.length < 2) return '';
    if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }
    if (points.length === 3) {
        return `M ${points[0].x} ${points[0].y} Q ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`;
    }
    return '';
};

interface CanvasProps {
    annotations: Annotation[];
    getSelectedIds: () => string[];
    hoveredId: string | null;
    hoveredAnchorIndex: number | null;
    getCursorForAnchorIndex: (anchorIndex: number) => string;
    tool: string;
    color: string;
    strokeWidth: number;
    eraserSize: number;
    currentPoints: number[];
    selectionRect: { x: number; y: number; width: number; height: number } | null;
    selectedShapeType: ShapeType;
    editingAnnotationId: string | null;
    editingControlPointIndex: number | null;
    isDrawingPolygon: boolean;
    polygonPoints: Point[];
    isDrawingLine: boolean;
    linePoints: Point[];
    isDrawingBezier: boolean;
    bezierPoints: Point[];
    onMouseDown: (e: { point: Point; ctrlKey?: boolean; metaKey?: boolean }) => void;
    onMouseMove: (e: { point: Point; shiftKey?: boolean }) => void;
    onMouseUp: () => void;
    onDoubleClick: (e: { point: Point }) => void;
    onVertexClick?: (vertexIndex: number) => void;
    onTextEdit?: (annotationId: string, newText: string) => void;
    onTextEditCancel?: () => void;
}

export default function Canvas({
    annotations,
    getSelectedIds,
    hoveredId,
    hoveredAnchorIndex,
    getCursorForAnchorIndex,
    tool,
    color,
    strokeWidth,
    eraserSize,
    currentPoints,
    selectionRect,
    selectedShapeType,
    editingAnnotationId,
    editingControlPointIndex,
    isDrawingPolygon,
    polygonPoints,
    isDrawingLine,
    linePoints,
    isDrawingBezier,
    bezierPoints,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onVertexClick,
    onTextEdit,
    onTextEditCancel
}: CanvasProps) {
    const stageRef = useRef<Konva.Stage>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [isMounted, setIsMounted] = useState(false);
    const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
    const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState<string>('');
    const [lastAnnotationsLength, setLastAnnotationsLength] = useState(0);
    const [editingTextPosition, setEditingTextPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const doubleClickPendingRef = useRef<boolean>(false);

    // Handle client-side mounting
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Auto-start editing for new text annotations
    useEffect(() => {
        if (annotations.length > lastAnnotationsLength) {
            const textAnnotations = annotations.filter(ann => ann.type === 'text');
            if (textAnnotations.length > 0) {
                const newestText = textAnnotations[textAnnotations.length - 1];
                if (newestText.text === '' && !editingTextId) {
                    setEditingTextId(newestText.id);
                    setEditingText('');
                    setEditingTextPosition({
                        x: newestText.x,
                        y: newestText.y,
                        width: newestText.width,
                        height: newestText.height
                    });
                }
            }
        }
        setLastAnnotationsLength(annotations.length);
    }, [annotations, lastAnnotationsLength, editingTextId]);

    // Update canvas size based on container
    useEffect(() => {
        if (!isMounted) return;
        
        const updateSize = () => {
            if (containerRef.current) {
                const container = containerRef.current;
                const rect = container.getBoundingClientRect();
                const containerWidth = rect.width;
                const containerHeight = rect.height;
                
                setCanvasSize({
                    width: Math.max(400, containerWidth),
                    height: Math.max(300, containerHeight)
                });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [isMounted]);

    const getCanvasPoint = (evt?: MouseEvent): Point => {
        const stage = stageRef.current;
        if (!stage) return { x: 0, y: 0 };
        const pointerPosition = evt ? 
            stage.getRelativePointerPosition() : 
            stage.getPointerPosition();
        if (!pointerPosition) return { x: 0, y: 0 };
        return {
            x: pointerPosition.x,
            y: pointerPosition.y
        };
    };

    const handleMouseDown = (e: { evt: MouseEvent }) => {
        const point = getCanvasPoint(e.evt);
        
        // For polyline, check if we should skip this mouse down (might be part of double-click)
        if (tool === 'shape' && selectedShapeType === 'polyline' && isDrawingPolygon) {
            // Only handle vertex clicks for existing points
            if (polygonPoints.length > 0 && onVertexClick) {
                const threshold = 15;
                for (let i = 0; i < polygonPoints.length; i++) {
                    const vertex = polygonPoints[i];
                    const distance = Math.sqrt(
                        Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2)
                    );
                    if (distance <= threshold) {
                        onVertexClick(i);
                        return;
                    }
                }
            }
            // For polyline, don't immediately add points - wait to see if it's a double-click
            doubleClickPendingRef.current = true;
            // Set a timeout to handle single clicks (not double-clicks)
            setTimeout(() => {
                if (doubleClickPendingRef.current) {
                    // This was a single click, not a double-click, so add the point
                    onMouseDown({ 
                        point, 
                        ctrlKey: e.evt.ctrlKey, 
                        metaKey: e.evt.metaKey 
                    });
                    doubleClickPendingRef.current = false;
                }
            }, 250); // 250ms delay to allow double-click to be processed
            return;
        }
        
        if (tool === 'shape' && isDrawingPolygon && selectedShapeType === 'polygon' && polygonPoints.length > 0 && onVertexClick) {
            const threshold = 15; // Increased threshold for easier clicking
            for (let i = 0; i < polygonPoints.length; i++) {
                const vertex = polygonPoints[i];
                const distance = Math.sqrt(
                    Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2)
                );
                if (distance <= threshold) {
                    onVertexClick(i);
                    return;
                }
            }
        }
        
        onMouseDown({ 
            point, 
            ctrlKey: e.evt.ctrlKey, 
            metaKey: e.evt.metaKey 
        });
    };

    const handleMouseMove = (e: { evt: MouseEvent }) => {
        const point = getCanvasPoint(e.evt);
        setMousePosition(point);
        
        if (tool === 'shape' && isDrawingPolygon && (selectedShapeType === 'polygon' || selectedShapeType === 'polyline') && polygonPoints.length > 0) {
            const threshold = 15; // Increased threshold to match click detection
            let foundVertex = false;
            for (let i = 0; i < polygonPoints.length; i++) {
                const vertex = polygonPoints[i];
                const distance = Math.sqrt(
                    Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2)
                );
                if (distance <= threshold) {
                    setHoveredVertexIndex(i);
                    foundVertex = true;
                    break;
                }
            }
            if (!foundVertex) {
                setHoveredVertexIndex(null);
            }
        } else {
            setHoveredVertexIndex(null);
        }
        
        onMouseMove({ point, shiftKey: e.evt.shiftKey });
    };

    const handleMouseUp = () => {
        onMouseUp();
    };

    const handleTextDoubleClick = (annotationId: string, currentText: string) => {
        const annotation = annotations.find(ann => ann.id === annotationId);
        if (annotation && annotation.type === 'text') {
            setEditingTextId(annotationId);
            setEditingText(currentText);
            setEditingTextPosition({
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height
            });
        }
    };

    const handleTextEditSubmit = () => {
        setEditingTextId(null);
        setEditingText('');
        setEditingTextPosition(null);
    };

    const handleTextEditCancel = () => {
        if (editingTextId && onTextEdit) {
            const originalAnnotation = annotations.find(ann => ann.id === editingTextId);
            if (originalAnnotation && originalAnnotation.type === 'text') {
                onTextEdit(editingTextId, originalAnnotation.text);
            }
        }
        setEditingTextId(null);
        setEditingText('');
        setEditingTextPosition(null);
        onTextEditCancel?.();
    };

    const handleTextKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleTextEditSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleTextEditCancel();
        }
    };

    const renderAnnotation = useMemo(() => {
        return (annotation: Annotation) => {
            const isSelected = tool === 'select' && annotation.isSelected;
            const isHovered = hoveredId === annotation.id;
            const highlightColor = '#3b82f6';

            switch (annotation.type) {
                case 'stroke':
                    return (
                        <Line
                            key={annotation.id}
                            points={annotation.points}
                            stroke={annotation.color}
                            strokeWidth={annotation.strokeWidth}
                            lineCap="round"
                            lineJoin="round"
                            tension={0.5}
                            shadowColor={isSelected || isHovered ? highlightColor : undefined}
                            shadowBlur={isSelected || isHovered ? 5 : undefined}
                            shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                        />
                    );

                case 'shape':
                    if (annotation.shapeType === 'rectangle') {
                        return (
                            <Rect
                                key={annotation.id}
                                x={annotation.x}
                                y={annotation.y}
                                width={annotation.width}
                                height={annotation.height}
                                stroke={annotation.color}
                                strokeWidth={annotation.strokeWidth}
                                fill="transparent"
                                shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                shadowBlur={isSelected || isHovered ? 5 : undefined}
                                shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                            />
                        );
                    } else if (annotation.shapeType === 'ellipse') {
                        return (
                            <Ellipse
                                key={annotation.id}
                                x={annotation.x + annotation.width / 2}
                                y={annotation.y + annotation.height / 2}
                                radiusX={annotation.width / 2}
                                radiusY={annotation.height / 2}
                                stroke={annotation.color}
                                strokeWidth={annotation.strokeWidth}
                                fill="transparent"
                                shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                shadowBlur={isSelected || isHovered ? 5 : undefined}
                                shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                            />
                        );
                    } else if (annotation.shapeType === 'line') {
                        const points = annotation.points || [];
                        if (points.length >= 4) {
                            return (
                                <Line
                                    key={annotation.id}
                                    points={points}
                                    stroke={annotation.color}
                                    strokeWidth={annotation.strokeWidth}
                                    lineCap="round"
                                    shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                    shadowBlur={isSelected || isHovered ? 5 : undefined}
                                    shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                                />
                            );
                        }
                    } else if (annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline') {
                        const points = annotation.points || [];
                        if (points.length >= 4) {
                            return (
                                <Line
                                    key={annotation.id}
                                    points={points}
                                    stroke={annotation.color}
                                    strokeWidth={annotation.strokeWidth}
                                    lineCap="round"
                                    lineJoin="round"
                                    closed={annotation.shapeType === 'polygon'}
                                    shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                    shadowBlur={isSelected || isHovered ? 5 : undefined}
                                    shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                                />
                            );
                        }
                    } else if (annotation.shapeType === 'bezier') {
                        const points = annotation.points || [];
                        if (points.length >= 6) {
                            // Convert flat array to Point objects (3 points = 6 coordinates)
                            const pointObjects: Point[] = [];
                            for (let i = 0; i < 6; i += 2) {
                                if (i + 1 < points.length) {
                                    pointObjects.push({ x: points[i], y: points[i + 1] });
                                }
                            }
                            
                            const pathData = createBezierPath(pointObjects);
                            
                            return (
                                <Path
                                    key={annotation.id}
                                    data={pathData}
                                    stroke={annotation.color}
                                    strokeWidth={annotation.strokeWidth}
                                    lineCap="round"
                                    shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                    shadowBlur={isSelected || isHovered ? 5 : undefined}
                                    shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                                />
                            );
                        }
                    }
                    break;

                case 'text':
                    const isEditing = editingTextId === annotation.id;
                    return (
                        <Group key={annotation.id}>
                            {isEditing && (
                                <Rect
                                    x={annotation.x}
                                    y={annotation.y}
                                    width={annotation.width}
                                    height={annotation.height}
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dash={[10, 5]}
                                    fill="transparent"
                                />
                            )}
                            <Text
                                x={annotation.x + (isEditing ? 8 : 0)}
                                y={annotation.y + (isEditing ? 4 : 0)}
                                text={isEditing ? '' : annotation.text}
                                fontSize={annotation.fontSize}
                                fill={annotation.color}
                                width={isEditing ? annotation.width - 16 : annotation.width}
                                height={isEditing ? annotation.height - 12 : annotation.height}
                                shadowColor={isSelected || isHovered ? highlightColor : undefined}
                                shadowBlur={isSelected || isHovered ? 5 : undefined}
                                shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                                onDblClick={() => handleTextDoubleClick(annotation.id, annotation.text)}
                            />
                        </Group>
                    );

                case 'image':
                    return (
                        <KonvaImage
                            key={annotation.id}
                            x={annotation.x}
                            y={annotation.y}
                            image={annotation.image}
                            width={annotation.width}
                            height={annotation.height}
                            shadowColor={isSelected || isHovered ? highlightColor : undefined}
                            shadowBlur={isSelected || isHovered ? 5 : undefined}
                            shadowOffset={isSelected || isHovered ? { x: 2, y: 2 } : undefined}
                        />
                    );
            }
            return null;
        };
    }, [tool, hoveredId, editingTextId, editingText, annotations, onTextEdit]);

    const renderControlPoints = useCallback((annotation: Annotation) => {
        // Only show control points when selection tool is active, editing (single selection) and for specific shape types
        if (tool !== 'select' || !annotation.isSelected || !annotation.isEditing) return null;
        
        const controlPoints = [];
        
        if (annotation.type === 'shape') {
            // Only show control points for line-based shapes when editing
            if (annotation.shapeType === 'line' || annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline' || annotation.shapeType === 'bezier') {
                const points = annotation.points || [];
                for (let i = 0; i < points.length; i += 2) {
                    const pointIndex = i / 2;
                    const isEditing = editingAnnotationId === annotation.id && editingControlPointIndex === pointIndex;
                    
                    controlPoints.push(
                        <Circle
                            key={`control-${annotation.id}-${pointIndex}`}
                            x={points[i]}
                            y={points[i + 1]}
                            radius={isEditing ? 8 : 6}
                            fill={isEditing ? "#ff6b6b" : "#3b82f6"}
                            stroke="white"
                            strokeWidth={2}
                            shadowColor={isEditing ? "#ff6b6b" : "#3b82f6"}
                            shadowBlur={8}
                        />
                    );
                }
            }
        }
        // Temporarily disable control point rendering for stroke annotations
        // else if (annotation.type === 'stroke') {
        //     for (let i = 0; i < annotation.points.length; i += 2) {
        //         const pointIndex = i / 2;
        //         const isEditing = editingAnnotationId === annotation.id && editingControlPointIndex === pointIndex;
        //         
        //         controlPoints.push(
        //             <Circle
        //                 key={`control-${annotation.id}-${pointIndex}`}
        //                 x={annotation.points[i]}
        //                 y={annotation.points[i + 1]}
        //                 radius={isEditing ? 8 : 6}
        //                 fill={isEditing ? "#ff6b6b" : "#3b82f6"}
        //                 stroke="white"
        //                 strokeWidth={2}
        //                 shadowColor={isEditing ? "#ff6b6b" : "#3b82f6"}
        //                 shadowBlur={8}
        //             />
        //         );
        //     }
        // }
        
        return controlPoints;
    }, [tool, editingAnnotationId, editingControlPointIndex]);

    const renderBoundingBox = useCallback((annotation: Annotation) => {
        if (tool !== 'select' || !annotation.isSelected) return null;
        
        // Calculate bounds dynamically
        const { x, y, width, height } = calculateBounds(annotation);
        
        
        return (
            <Rect
                key={`bbox-${annotation.id}`}
                x={x - 4}
                y={y - 4}
                width={width + 8}
                height={height + 8}
                stroke="#3b82f6"
                strokeWidth={2}
                fill="transparent"
                dash={[5, 5]}
                opacity={0.8}
            />
        );
    }, [tool]);

    const renderAnchorPoints = useCallback((annotation: Annotation) => {
        if (tool !== 'select' || !annotation.isSelected) return null;
        
        const { x, y, width, height } = calculateBounds(annotation);
        const anchorSize = 8;
        
        // Define anchor points: 8 points around the rectangle
        const anchors = [
            { x: x - anchorSize/2, y: y - anchorSize/2, cursor: 'nw-resize' }, // top-left
            { x: x + width/2, y: y - anchorSize/2, cursor: 'n-resize' }, // top-center
            { x: x + width - anchorSize/2, y: y - anchorSize/2, cursor: 'ne-resize' }, // top-right
            { x: x + width - anchorSize/2, y: y + height/2, cursor: 'e-resize' }, // right-center
            { x: x + width - anchorSize/2, y: y + height - anchorSize/2, cursor: 'se-resize' }, // bottom-right
            { x: x + width/2, y: y + height - anchorSize/2, cursor: 's-resize' }, // bottom-center
            { x: x - anchorSize/2, y: y + height - anchorSize/2, cursor: 'sw-resize' }, // bottom-left
            { x: x - anchorSize/2, y: y + height/2, cursor: 'w-resize' }, // left-center
        ];
        
        return anchors.map((anchor, index) => (
            <Circle
                key={`anchor-${annotation.id}-${index}`}
                x={anchor.x + anchorSize/2}
                y={anchor.y + anchorSize/2}
                radius={anchorSize/2}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                shadowColor="#3b82f6"
                shadowBlur={4}
            />
        ));
    }, [tool]);

    if (!isMounted) {
        return (
            <div ref={containerRef} className="canvas-container bg-white shadow-2xl flex items-center justify-center">
                <div className="text-gray-500 font-medium">Loading canvas...</div>
            </div>
        );
    }


    return (
        <div ref={containerRef} className="canvas-container bg-white shadow-2xl">
            <Stage
                ref={stageRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDblClick={(e) => {
                    const point = getCanvasPoint(e.evt);
                    // Clear the double-click pending flag
                    doubleClickPendingRef.current = false;
                    onDoubleClick({ point });
                }}
                className={`konva-stage ${tool === 'eraser' ? 'eraser-cursor' : ''}`}
                style={{ 
                    cursor: hoveredAnchorIndex !== null 
                        ? getCursorForAnchorIndex(hoveredAnchorIndex)
                        : tool === 'select' && getSelectedIds().length > 0 
                            ? 'move' 
                            : tool === 'eraser' 
                                ? 'none' 
                                : 'crosshair' 
                }}
            >
                <Layer>
                    {/* Render all annotations */}
                    {annotations.map((annotation) => renderAnnotation(annotation))}
                    
                    {/* Render bounding boxes, anchor points, and control points for selected annotations */}
                    {tool === 'select' && annotations.map((annotation) => (
                        <React.Fragment key={`edit-${annotation.id}`}>
                            {renderBoundingBox(annotation)}
                            {renderAnchorPoints(annotation)}
                            {renderControlPoints(annotation)}
                        </React.Fragment>
                    ))}
                    
                    {/* Render current drawing */}
                    {tool === 'brush' && currentPoints.length > 0 && (
                        <Line
                            points={currentPoints}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            lineCap="round"
                            lineJoin="round"
                            tension={0.5}
                        />
                    )}
                    
                    {/* Render current shape */}
                    {tool === 'shape' && currentPoints.length === 4 && selectedShapeType !== 'polygon' && selectedShapeType !== 'polyline' && selectedShapeType !== 'bezier' && (
                        <>
                            {selectedShapeType === 'rectangle' && (
                                <Rect
                                    x={Math.min(currentPoints[0], currentPoints[2])}
                                    y={Math.min(currentPoints[1], currentPoints[3])}
                                    width={Math.abs(currentPoints[2] - currentPoints[0])}
                                    height={Math.abs(currentPoints[3] - currentPoints[1])}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    fill="transparent"
                                />
                            )}
                            {selectedShapeType === 'ellipse' && (
                                <Ellipse
                                    x={(currentPoints[0] + currentPoints[2]) / 2}
                                    y={(currentPoints[1] + currentPoints[3]) / 2}
                                    radiusX={Math.abs(currentPoints[2] - currentPoints[0]) / 2}
                                    radiusY={Math.abs(currentPoints[3] - currentPoints[1]) / 2}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    fill="transparent"
                                />
                            )}
                            {selectedShapeType === 'line' && (
                                <Line
                                    points={currentPoints}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    lineCap="round"
                                />
                            )}
                        </>
                    )}
                    
                    {/* Render line drawing mode */}
                    {tool === 'shape' && selectedShapeType === 'line' && isDrawingLine && linePoints.length > 0 && (
                        <Line
                            points={[linePoints[0].x, linePoints[0].y, mousePosition.x, mousePosition.y]}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            lineCap="round"
                        />
                    )}
                    
                    {/* Render bezier curve drawing mode */}
                    {tool === 'shape' && selectedShapeType === 'bezier' && isDrawingBezier && bezierPoints.length > 0 && (
                        <>
                            {/* Render bezier curve preview with current points + mouse position */}
                            {bezierPoints.length === 1 && (
                                <Line
                                    points={[bezierPoints[0].x, bezierPoints[0].y, mousePosition.x, mousePosition.y]}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    lineCap="round"
                                    dash={[5, 5]}
                                    opacity={0.5}
                                />
                            )}
                            {bezierPoints.length === 2 && (
                                <Path
                                    data={createBezierPath([...bezierPoints, mousePosition])}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    lineCap="round"
                                    opacity={0.7}
                                />
                            )}
                        </>
                    )}
                    
                    {/* Render current polygon/polyline */}
                    {tool === 'shape' && isDrawingPolygon && polygonPoints.length > 0 && (
                        <>
                            <Line
                                points={polygonPoints.flatMap(p => [p.x, p.y])}
                                stroke={color}
                                strokeWidth={strokeWidth}
                                lineCap="round"
                                lineJoin="round"
                                closed={false}
                            />
                            
                            {/* Render preview line from last point to cursor */}
                            {polygonPoints.length > 0 && (
                                <Line
                                    points={[
                                        polygonPoints[polygonPoints.length - 1].x,
                                        polygonPoints[polygonPoints.length - 1].y,
                                        mousePosition.x,
                                        mousePosition.y
                                    ]}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    lineCap="round"
                                    dash={[5, 5]}
                                    opacity={0.7}
                                />
                            )}
                            
                            {/* For polygons with 3+ points, show preview line to start point when hovering over control_point_1 */}
                            {selectedShapeType === 'polygon' && polygonPoints.length >= 3 && hoveredVertexIndex === 0 && (
                                <Line
                                    points={[
                                        mousePosition.x,
                                        mousePosition.y,
                                        polygonPoints[0].x,
                                        polygonPoints[0].y
                                    ]}
                                    stroke="#4ade80"
                                    strokeWidth={strokeWidth + 2}
                                    lineCap="round"
                                    dash={[8, 4]}
                                    opacity={0.8}
                                />
                            )}
                            
                            {/* Render vertex points */}
                            {polygonPoints.map((point, index) => {
                                const isHovered = hoveredVertexIndex === index;
                                const isStartPoint = index === 0 && selectedShapeType === 'polygon' && polygonPoints.length >= 3;
                                return (
                                    <Circle
                                        key={`vertex-${index}`}
                                        x={point.x}
                                        y={point.y}
                                        radius={isHovered ? 6 : (isStartPoint ? 5 : 4)}
                                        fill={isStartPoint ? "#4ade80" : color}
                                        stroke={isHovered ? "#ff6b6b" : (isStartPoint ? "#22c55e" : "white")}
                                        strokeWidth={isHovered ? 3 : (isStartPoint ? 3 : 2)}
                                        shadowColor={isHovered ? "#ff6b6b" : (isStartPoint ? "#22c55e" : undefined)}
                                        shadowBlur={isHovered || isStartPoint ? 8 : undefined}
                                    />
                                );
                            })}
                        </>
                    )}
                    
                    {/* Render selection rectangle */}
                    {selectionRect && (
                        <Rect
                            x={selectionRect.x}
                            y={selectionRect.y}
                            width={selectionRect.width}
                            height={selectionRect.height}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dash={[10, 5]}
                        />
                    )}
                    
                    {/* Render eraser circle */}
                    {tool === 'eraser' && (
                        <Circle
                            x={mousePosition.x}
                            y={mousePosition.y}
                            radius={eraserSize / 2}
                            stroke="#333"
                            strokeWidth={2}
                            fill="transparent"
                            opacity={0.7}
                        />
                    )}
                    
                </Layer>
            </Stage>
            
            {/* HTML input overlay for text editing */}
            {editingTextId && editingTextPosition && (
                <textarea
                    className="absolute resize-none outline-none bg-transparent border-none"
                    style={{
                        left: editingTextPosition.x + 8,
                        top: editingTextPosition.y + 2,
                        width: editingTextPosition.width - 16,
                        height: editingTextPosition.height - 12,
                        fontSize: '24px',
                        fontFamily: 'Arial, sans-serif',
                        color: '#000000',
                        zIndex: 1000
                    }}
                    value={editingText}
                    onChange={(e) => {
                        const newText = e.target.value;
                        setEditingText(newText);
                        if (onTextEdit) {
                            onTextEdit(editingTextId, newText);
                        }
                    }}
                    onKeyDown={handleTextKeyDown}
                    onBlur={handleTextEditSubmit}
                    autoFocus
                />
            )}
        </div>
    );
}