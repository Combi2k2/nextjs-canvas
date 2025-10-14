export interface Point {
    x: number;
    y: number;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface BaseAnnotation {
    id: string;
    type: 'stroke' | 'text' | 'image' | 'shape';
    color: string;
    strokeWidth: number;
    isEditing: boolean;
    isSelected: boolean;
}

export interface StrokeAnnotation extends BaseAnnotation {
    type: 'stroke';
    points: number[];
}

export interface TextAnnotation extends BaseAnnotation {
    type: 'text';
    text: string;
    x: number;
    y: number;
    fontSize: number;
    width: number;
    height: number;
}

export interface ImageAnnotation extends BaseAnnotation {
    type: 'image';
    image: HTMLImageElement;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ShapeData {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    points?: number[];
}

export interface ShapeAnnotation extends BaseAnnotation {
    type: 'shape';
    shapeType: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    points: number[];
}

export type Annotation = StrokeAnnotation | TextAnnotation | ImageAnnotation | ShapeAnnotation;

export interface SelectionRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextInput {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface DragState {
    isDragging: boolean;
    startPoint: Point | null;
    offset: Point;
}

export interface ResizeState {
    isResizing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    anchorIndex: number | null;
    originalAnnotation: Annotation | null;
}

export type Tool = 'select' | 'brush' | 'shape' | 'text' | 'image' | 'eraser' | 'ai';
export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'polyline' | 'line' | 'bezier';

export interface DrawingState {
    tool: Tool;
    annotations: Annotation[];
    history: Annotation[][];
    historyStep: number;
    color: string;
    strokeWidth: number;
    isDrawing: boolean;
    currentPoints: number[];
    selectionRect: SelectionRect | null;
    textInput: TextInput;
    showColorPicker: boolean;
    dragState: DragState;
    resizeState: ResizeState;
    hoveredId: string | null;
    selectedShapeType: ShapeType;
    isDrawingPolygon: boolean;
    polygonPoints: Point[];
}