'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import React from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Image as KonvaImage, Ellipse, Group, Path } from 'react-konva';
import Konva from 'konva';
import { Annotation, Point, ShapeType, Bounds } from '@/types/annotations';
import { calculateBounds } from '@/hooks/useDrawingState';
import { GoogleGenerativeAI } from "@google/generative-ai";
import AiChatbox from './AiChatbox';

const GOOGLE_APIKEY = process.env.NEXT_PUBLIC_GOOGLE_APIKEY;
const SYSTEM_PROMPT = `
You are an image generation model specialized in creating visuals that emulate the aesthetic of a digital canvas drawing app. When a user requests an image, whether it's a new creation or a refinement of an existing one:

1.  **Refined Canvas App Aesthetic Priority:** Always ensure the generated images look like they were drawn with care and precision in a digital canvas application, aiming for a clean and attractive illustrative style. This includes:
*   **Clear, often bold outlines:** Objects should be defined by distinct, mostly smooth lines (can be black or a contrasting color).
*   **Flat, solid color fills:** Avoid complex gradients or photorealistic textures. Colors should be blocky and consistent within defined areas.
*   **Stylized and clear forms:** Represent objects with well-defined, easily recognizable, and appealingly stylized shapes. Maintain visual clarity and good design principles.
*   **Thoughtful, minimal shading (if any):** If shading is present, it should be simple cell shading (hard transitions between different color blocks) rather than subtle gradients or realistic light play.
*   **Non-photorealistic style:** The output should clearly be an illustration or drawing, not a photograph or a highly detailed render.

2.  **User Prompt Adherence & Refinement:** Carefully interpret the user's request. If an input image is provided for refinement, identify the core elements and suggested improvements. If a text prompt is given, create a new image that directly reflects the description while adhering strictly to the canvas app style.

3.  **Multiple Options for User Choice:** Generate **3 to 5 distinct variations** of the requested image. Each variation should offer a slightly different perspective, composition, or interpretation of the prompt, allowing the user to select their preferred outcome. Ensure all variations maintain the canvas app aesthetic.

4.  **Formatting:** Present the images clearly, preferably in a sequential format, ready for the user's review.

The background of the generated image must be white`


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
    aiSelectionRect?: { x: number; y: number; width: number; height: number } | null;
    startAiSelection?: (point: Point) => void;
    updateAiSelection?: (point: Point) => void;
    endAiSelection?: () => any;
    onAiImagesGenerated?: (images: string[]) => void;
    onCloseAiChatbox?: () => void;
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
    onTextEditCancel,
    aiSelectionRect,
    startAiSelection,
    updateAiSelection,
    endAiSelection,
    onAiImagesGenerated,
    onCloseAiChatbox
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
    const [showAiChatbox, setShowAiChatbox] = useState(false);
    const [aiChatboxPosition, setAiChatboxPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [lastMousePosition, setLastMousePosition] = useState<Point>({ x: 0, y: 0 });
    const [touchState, setTouchState] = useState<{
        isGesturing: boolean;
        initialDistance: number;
        initialScale: number;
        initialCenter: Point;
        lastTouches: React.Touch[];
    }>({
        isGesturing: false,
        initialDistance: 0,
        initialScale: 1,
        initialCenter: { x: 0, y: 0 },
        lastTouches: []
    });

    // Handle client-side mounting
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Close AI chatbox when tool changes away from AI
    useEffect(() => {
        if (tool !== 'ai' && showAiChatbox) {
            setShowAiChatbox(false);
            setCapturedImage(null);
            onCloseAiChatbox?.();
        }
    }, [tool, showAiChatbox, onCloseAiChatbox]);

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

    const getCanvasPoint = (evt?: MouseEvent | TouchEvent): Point => {
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

    // Helper function to get touch point from touch event
    const getTouchPoint = (touch: React.Touch): Point => {
        const stage = stageRef.current;
        if (!stage) return { x: 0, y: 0 };
        
        const stageBox = stage.container().getBoundingClientRect();
        const scaleX = stage.width() / stageBox.width;
        const scaleY = stage.height() / stageBox.height;
        
        return {
            x: (touch.clientX - stageBox.left) * scaleX,
            y: (touch.clientY - stageBox.top) * scaleY
        };
    };

    // Helper function to get pressure from touch event (if supported)
    const getTouchPressure = (touch: React.Touch): number => {
        // Check if pressure is supported (mainly for stylus input)
        if ('force' in touch && typeof (touch as any).force === 'number') {
            return Math.max(0.1, Math.min(1, (touch as any).force));
        }
        // Fallback: simulate pressure based on touch area (if available)
        if ('radiusX' in touch && 'radiusY' in touch) {
            const area = Math.PI * (touch as any).radiusX * (touch as any).radiusY;
            const maxArea = Math.PI * 20 * 20; // Assume max radius of 20
            return Math.max(0.1, Math.min(1, area / maxArea));
        }
        return 1; // Default pressure
    };

    // Helper function to calculate distance between two touches
    const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Helper function to calculate center point between two touches
    const getTouchCenter = (touch1: React.Touch, touch2: React.Touch): Point => {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
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
        
        // Handle AI tool - capture entire canvas on click
        if (tool === 'ai') {
            // Capture the entire canvas
            const fullCanvasImage = captureImageFromCanvas({
                x: 0,
                y: 0,
                width: canvasSize.width,
                height: canvasSize.height
            });
            
            if (fullCanvasImage) {
                setCapturedImage(fullCanvasImage);
                setAiChatboxPosition({
                    x: canvasSize.width / 2,
                    y: canvasSize.height / 2
                });
                setShowAiChatbox(true);
            }
            return;
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
        setLastMousePosition(point);
        
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
        
        // AI tool no longer uses drag selection - removed
        
        onMouseMove({ point, shiftKey: e.evt.shiftKey });
    };

    const handleMouseUp = () => {
        // AI tool now uses click-to-capture instead of drag selection
        onMouseUp();
    };

    // Touch event handlers
    const handleTouchStart = (e: any) => {
        const touchEvent = e.evt as TouchEvent;
        touchEvent.preventDefault(); // Prevent scrolling and other default touch behaviors
        
        if (touchEvent.touches.length === 1) {
            const touch = touchEvent.touches[0] as React.Touch;
            const point = getTouchPoint(touch);
            const pressure = getTouchPressure(touch);
            
            // Reset gesture state
            setTouchState(prev => ({
                ...prev,
                isGesturing: false,
                lastTouches: [touch]
            }));
            
            // For drawing tools, adjust stroke width based on pressure
            if (tool === 'brush' && pressure !== 1) {
                // Store original stroke width and apply pressure-based scaling
                const pressureAdjustedWidth = strokeWidth * pressure;
                // This would need to be passed to the drawing state
                // For now, we'll simulate the mouse event normally
            }
            
            // Simulate mouse down event
            const mockMouseEvent = {
                ...touchEvent,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                button: 0,
                buttons: 1,
                clientX: touch.clientX,
                clientY: touch.clientY,
                pageX: touch.pageX,
                pageY: touch.pageY,
                screenX: touch.screenX,
                screenY: touch.screenY,
                movementX: 0,
                movementY: 0,
                relatedTarget: null,
                getModifierState: () => false,
                initMouseEvent: () => {},
                which: 1,
                detail: 0
            } as unknown as MouseEvent;
            
            handleMouseDown({ evt: mockMouseEvent });
        } else if (touchEvent.touches.length === 2) {
            // Start pinch gesture
            const touch1 = touchEvent.touches[0] as React.Touch;
            const touch2 = touchEvent.touches[1] as React.Touch;
            const distance = getTouchDistance(touch1, touch2);
            const center = getTouchCenter(touch1, touch2);
            
            setTouchState(prev => ({
                ...prev,
                isGesturing: true,
                initialDistance: distance,
                initialScale: 1,
                initialCenter: center,
                lastTouches: [touch1, touch2]
            }));
        }
    };

    const handleTouchMove = (e: any) => {
        const touchEvent = e.evt as TouchEvent;
        touchEvent.preventDefault(); // Prevent scrolling
        
        if (touchEvent.touches.length === 1 && !touchState.isGesturing) {
            const touch = touchEvent.touches[0] as React.Touch;
            const point = getTouchPoint(touch);
            
            // Simulate mouse move event
            const mockMouseMoveEvent = {
                ...touchEvent,
                shiftKey: false,
                button: 0,
                buttons: 1,
                clientX: touch.clientX,
                clientY: touch.clientY,
                pageX: touch.pageX,
                pageY: touch.pageY,
                screenX: touch.screenX,
                screenY: touch.screenY,
                movementX: 0,
                movementY: 0,
                relatedTarget: null,
                getModifierState: () => false,
                initMouseEvent: () => {},
                which: 1,
                detail: 0
            } as unknown as MouseEvent;
            
            handleMouseMove({ evt: mockMouseMoveEvent });
        } else if (touchEvent.touches.length === 2 && touchState.isGesturing) {
            // Handle pinch gesture
            const touch1 = touchEvent.touches[0] as React.Touch;
            const touch2 = touchEvent.touches[1] as React.Touch;
            const currentDistance = getTouchDistance(touch1, touch2);
            const currentCenter = getTouchCenter(touch1, touch2);
            
            // Calculate scale change
            const scaleChange = currentDistance / touchState.initialDistance;
            
            // Apply zoom to the stage
            const stage = stageRef.current;
            if (stage) {
                const newScale = Math.max(0.1, Math.min(5, scaleChange));
                stage.scale({ x: newScale, y: newScale });
                
                // Adjust position to zoom around the center point
                const stageBox = stage.container().getBoundingClientRect();
                const centerX = (currentCenter.x - stageBox.left) * (stage.width() / stageBox.width);
                const centerY = (currentCenter.y - stageBox.top) * (stage.height() / stageBox.height);
                
                const offsetX = centerX - centerX * newScale;
                const offsetY = centerY - centerY * newScale;
                
                stage.position({
                    x: stage.x() + offsetX,
                    y: stage.y() + offsetY
                });
            }
            
            setTouchState(prev => ({
                ...prev,
                lastTouches: [touch1, touch2]
            }));
        }
    };

    const handleTouchEnd = (e: any) => {
        const touchEvent = e.evt as TouchEvent;
        touchEvent.preventDefault(); // Prevent default touch behaviors
        
        if (touchEvent.touches.length === 0) {
            // All touches ended
            setTouchState(prev => ({
                ...prev,
                isGesturing: false,
                lastTouches: []
            }));
            
            // Simulate mouse up event
            handleMouseUp();
        } else if (touchEvent.touches.length === 1 && touchState.isGesturing) {
            // One finger lifted during gesture - continue with single touch
            setTouchState(prev => ({
                ...prev,
                isGesturing: false,
                lastTouches: [touchEvent.touches[0] as React.Touch]
            }));
        }
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

    // AI image capture function
    const captureImageFromCanvas = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
        const stage = stageRef.current;
        if (!stage) return null;

        try {
            // Create a temporary stage with only the selected area
            const tempStage = new Konva.Stage({
                container: document.createElement('div'),
                width: rect.width,
                height: rect.height,
            });

            const tempLayer = new Konva.Layer();
            tempStage.add(tempLayer);

            // Clone and position all annotations within the selection area
            const stageLayer = stage.getLayers()[0];
            stageLayer.getChildren().forEach((node: any) => {
                if (node.getClassName() !== 'Stage') {
                    const cloned = node.clone();
                    cloned.position({
                        x: node.x() - rect.x,
                        y: node.y() - rect.y,
                    });
                    tempLayer.add(cloned);
                }
            });

            tempLayer.draw();
            
            // Convert to data URL
            const dataURL = tempStage.toDataURL({
                x: 0,
                y: 0,
                width: rect.width,
                height: rect.height,
                mimeType: 'image/png',
                quality: 1,
            });

            // Clean up
            tempStage.destroy();
            
            return dataURL;
        } catch (error) {
            console.error('Error capturing image:', error);
            return null;
        }
    }, []);

    // AI functions
    const handleAiPrompt = useCallback(async (prompt: string) => {
        if (!GOOGLE_APIKEY) {
            alert('API key is not set. Please set NEXT_PUBLIC_GOOGLE_APIKEY in your environment variables.');
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(GOOGLE_APIKEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

            // Prepare the content for the AI request
            const contents = [];
            
            if (capturedImage) {
                contents.push(
                    { text: SYSTEM_PROMPT },
                    { text: prompt },
                    { 
                        inlineData: {
                            mimeType: 'image/png',
                            data: capturedImage.split(',')[1] // Remove the data URL prefix
                        }
                    }
                );
            } else {
                contents.push(
                    { text: SYSTEM_PROMPT },
                    { text: prompt }
                )
            }

            // Non-streaming call; only collect images
            const result = await model.generateContent(contents);
            const generatedImages: string[] = [];
            const candidates = (result as any)?.response?.candidates || (result as any)?.candidates || [];
            for (const cand of candidates) {
                const parts = cand?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
                        const imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        generatedImages.push(imageDataUrl);
                    }
                }
            }

            if (generatedImages.length > 0) {
                onAiImagesGenerated?.(generatedImages);
            }

        } catch (error) {
            console.error('Error calling AI service:', error);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
        } finally {
            // Clean up
            setShowAiChatbox(false);
            setCapturedImage(null);
        }
    }, [capturedImage, onAiImagesGenerated]);

    const handleVoiceStart = useCallback(() => {
        console.log('Voice recognition started');
    }, []);

    const handleVoiceEnd = useCallback(() => {
        console.log('Voice recognition ended');
    }, []);

    const renderAnnotation = useMemo(() => {
        const AnnotationRenderer = (annotation: Annotation) => {
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
        
        AnnotationRenderer.displayName = 'AnnotationRenderer';
        return AnnotationRenderer;
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
                            radius={isEditing ? 12 : 10}
                            fill={isEditing ? "#ff6b6b" : "#3b82f6"}
                            stroke="white"
                            strokeWidth={2}
                            shadowColor={isEditing ? "#ff6b6b" : "#3b82f6"}
                            shadowBlur={8}
                            opacity={0.9}
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
        // Use larger anchor size for touch devices
        const anchorSize = 12;
        const touchPadding = 4; // Extra padding for touch targets
        
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
                radius={anchorSize/2 + touchPadding}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                shadowColor="#3b82f6"
                shadowBlur={6}
                opacity={0.8}
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
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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
                                : tool === 'ai'
                                    ? 'pointer'
                                    : 'crosshair',
                    touchAction: 'none' // Prevent default touch behaviors
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
                    
                    {/* AI selection rectangle - removed since we now use click-to-capture */}
                    
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
            
            {/* AI Chatbox */}
            {showAiChatbox && (
                <AiChatbox
                    x={aiChatboxPosition.x}
                    y={aiChatboxPosition.y}
                    onClose={() => {
                        setShowAiChatbox(false);
                        setCapturedImage(null);
                    }}
                    onSubmit={handleAiPrompt}
                    onVoiceStart={handleVoiceStart}
                    onVoiceEnd={handleVoiceEnd}
                    isVoiceSupported={typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)}
                />
            )}
        </div>
    );
}