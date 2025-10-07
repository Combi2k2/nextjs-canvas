# Drawing Application Documentation

## Overview

This is a React-based drawing application built with Next.js, TypeScript, and Konva.js. The application provides a comprehensive set of drawing tools including brushes, shapes, text, and advanced annotation management with selection, resizing, and editing capabilities.

## Architecture

### Technology Stack
- **Frontend**: React 18 with Next.js 15
- **Canvas Rendering**: Konva.js with react-konva
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks with custom state management

### Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main application page
├── components/            # React components
│   ├── Canvas.tsx        # Main canvas component with Konva rendering
│   ├── DrawingApp.tsx    # Main application component
│   ├── TextInput.tsx     # Text input overlay component
│   └── Toolbar.tsx       # Drawing tools toolbar
├── hooks/                # Custom React hooks
│   └── useDrawingState.ts # Main state management hook
├── types/                # TypeScript type definitions
│   └── annotations.ts    # Annotation and drawing types
└── utils/                # Utility functions
    └── geometry.ts       # Geometric calculations and hit detection
```

## Core Components

### 1. DrawingApp.tsx
The main application component that orchestrates all drawing functionality.

**Key Responsibilities:**
- Tool selection and management
- Mouse event handling (down, move, up)
- Annotation lifecycle management
- Keyboard shortcuts
- Drawing state coordination

**Key Features:**
- Multi-tool support (brush, shapes, text, select, eraser)
- Real-time drawing feedback
- Selection and multi-selection
- Drag and drop functionality
- Resize operations
- History management (undo/redo)

### 2. Canvas.tsx
The rendering component using Konva.js for high-performance canvas operations.

**Key Responsibilities:**
- Konva Stage and Layer management
- Annotation rendering
- Bounding box and anchor point rendering
- Control point visualization
- Interactive element positioning

**Rendering Features:**
- Real-time annotation display
- Selection highlighting
- Bounding box visualization
- Resize anchor points
- Control point editing
- Preview modes for drawing tools

### 3. useDrawingState.ts
The core state management hook containing all drawing logic.

**State Management:**
- Annotation storage and manipulation
- Drawing tool states
- Selection and editing states
- History management
- Resize and drag operations

**Key Functions:**
- `calculateBounds()`: Dynamic bounding box calculation
- `resizeAnnotation()`: Rate-based resize with inverted resizing support
- `getHoveredAnchorIndex()`: Anchor point detection
- `createAnnotation()`: Annotation creation with proper initialization

## Data Structures

### Annotation Types

The application supports multiple annotation types through a unified interface:

```typescript
interface BaseAnnotation {
    id: string;
    type: 'stroke' | 'text' | 'image' | 'shape';
    color: string;
    strokeWidth: number;
    isEditing: boolean;
    isSelected: boolean;
}

interface StrokeAnnotation extends BaseAnnotation {
    type: 'stroke';
    points: number[]; // Flat array of [x, y, x, y, ...]
}

interface ShapeAnnotation extends BaseAnnotation {
    type: 'shape';
    shapeType: 'rectangle' | 'ellipse' | 'polygon' | 'polyline' | 'line' | 'bezier';
    x: number;
    y: number;
    width: number;
    height: number;
    points: number[];
}

interface TextAnnotation extends BaseAnnotation {
    type: 'text';
    text: string;
    x: number;
    y: number;
    fontSize: number;
    width: number;
    height: number;
}
```

### State Interfaces

```typescript
interface ResizeState {
    isResizing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    anchorIndex: number | null;
    originalAnnotation: Annotation | null; // Deep copy for accurate resizing
}

interface DragState {
    isDragging: boolean;
    startPoint: Point | null;
    offset: Point;
}
```

## Drawing Tools

### 1. Brush Tool
- **Type**: Freehand drawing
- **Data**: Array of points `[x1, y1, x2, y2, ...]`
- **Features**: Smooth curves with tension, variable stroke width

### 2. Shape Tools
- **Rectangle**: Drag-to-create rectangles
- **Ellipse**: Drag-to-create ellipses
- **Line**: Click-to-click or drag-to-create lines
- **Polygon**: Multi-click polygon creation
- **Polyline**: Multi-click polyline creation
- **Bezier**: Three-point bezier curves

### 3. Text Tool
- **Creation**: Drag to create text area
- **Editing**: Double-click to edit inline
- **Features**: Auto-resize, font size control

### 4. Select Tool
- **Selection**: Click to select, Ctrl+click for multi-select
- **Bounding Box**: Visual selection indicator
- **Resize**: 8-point anchor system with rate-based scaling
- **Drag**: Move selected annotations
- **Control Points**: Edit individual points for line-based shapes

### 5. Eraser Tool
- **Functionality**: Click to delete annotations
- **Detection**: Geometric intersection with eraser circle

## Advanced Features

### Rate-Based Resizing

The application implements a sophisticated resize system that supports inverted resizing:

```typescript
// Calculate rates relative to unchanged anchor point
widthRate = (unchangedX - newX) / originalBounds.width;
heightRate = (unchangedY - newY) / originalBounds.height;

// Apply rate-based transformation
new_px = unchangedX + (old_px - unchangedX) * widthRate;
new_py = unchangedY + (old_py - unchangedY) * heightRate;
```

**Benefits:**
- Accurate scaling relative to original state
- Support for inverted resizing (negative rates)
- Consistent behavior across all annotation types
- Real-time updates without stale state

### Dynamic Bounding Box Calculation

Instead of storing bounds as properties, the application calculates them dynamically:

```typescript
export const calculateBounds = (annotation: Annotation): Bounds => {
    switch (annotation.type) {
        case 'stroke': {
            const xs = points.filter((_, i) => i % 2 === 0);
            const ys = points.filter((_, i) => i % 2 === 1);
            return {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };
        }
        // ... other types
    }
};
```

**Advantages:**
- Always accurate bounds
- No synchronization issues
- Cleaner data structures
- Better performance

### Control Point Editing

Line-based shapes support individual control point editing:
- **Detection**: Hover and click detection for control points
- **Visual Feedback**: Highlighted control points during editing
- **Real-time Updates**: Live preview during dragging
- **Bounds Recalculation**: Automatic bounds update after editing

## User Interactions

### Mouse Events

1. **Mouse Down**: Tool-specific initialization
   - Start drawing (brush, shapes)
   - Begin selection or resize
   - Initiate drag operations

2. **Mouse Move**: Real-time feedback
   - Drawing preview
   - Resize updates
   - Drag operations
   - Hover detection

3. **Mouse Up**: Completion
   - Finalize drawings
   - Complete resize operations
   - Save to history

### Keyboard Shortcuts

- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Y**: Redo
- **Ctrl/Cmd + Shift + Z**: Redo (alternative)
- **Delete**: Delete selected annotations
- **Ctrl/Cmd + D**: Duplicate selected annotations

### Selection System

- **Single Selection**: Click on annotation
- **Multi-Selection**: Ctrl/Cmd + click
- **Area Selection**: Drag to create selection rectangle
- **Clear Selection**: Click on empty area

## Performance Optimizations

### Konva.js Integration
- **Layer Management**: Separate layers for different rendering contexts
- **Event Delegation**: Efficient event handling
- **Conditional Rendering**: Only render necessary elements
- **Memoization**: useCallback and useMemo for expensive operations

### State Management
- **Immutable Updates**: Proper state mutation patterns
- **Batch Updates**: Group related state changes
- **History Management**: Efficient undo/redo system
- **Deep Copy**: JSON-based deep copying for resize operations

## File Structure Details

### /src/components/

**Canvas.tsx** (826 lines)
- Konva Stage setup and configuration
- Annotation rendering logic
- Interactive element positioning
- Real-time visual feedback

**DrawingApp.tsx** (939 lines)
- Main application logic
- Event handling coordination
- Tool state management
- Drawing workflow orchestration

**Toolbar.tsx**
- Tool selection interface
- Color and stroke width controls
- Shape type selection
- Tool state visualization

**TextInput.tsx**
- HTML overlay for text editing
- Inline text editing functionality
- Keyboard event handling

### /src/hooks/

**useDrawingState.ts** (453 lines)
- Complete state management
- Annotation CRUD operations
- Resize and drag logic
- History management
- Geometric calculations

### /src/types/

**annotations.ts** (121 lines)
- Complete type definitions
- Interface hierarchies
- State type definitions
- Tool and shape enumerations

### /src/utils/

**geometry.ts** (278 lines)
- Hit detection algorithms
- Distance calculations
- Intersection testing
- Geometric utilities

## Development Guidelines

### Adding New Tools

1. **Define Tool Type**: Add to `Tool` enum in `annotations.ts`
2. **Implement Logic**: Add handling in `DrawingApp.tsx` mouse events
3. **Add UI**: Update `Toolbar.tsx` with new tool button
4. **Update State**: Modify `useDrawingState.ts` if needed

### Adding New Annotation Types

1. **Define Interface**: Extend `BaseAnnotation` in `annotations.ts`
2. **Update Calculations**: Modify `calculateBounds()` function
3. **Add Rendering**: Update `Canvas.tsx` render logic
4. **Handle Interactions**: Update selection and editing logic

### Performance Considerations

- Use `useCallback` for event handlers
- Implement proper memoization for expensive calculations
- Minimize re-renders with careful state management
- Use Konva's built-in optimization features

## Testing

The application can be tested by:
1. Running `npm run dev`
2. Testing all drawing tools
3. Verifying selection and resize functionality
4. Testing keyboard shortcuts
5. Checking undo/redo operations

## Future Enhancements

Potential areas for improvement:
- Layer management system
- Advanced shape tools (freeform, star, etc.)
- Image import and manipulation
- Collaborative editing
- Export functionality (SVG, PNG, PDF)
- Advanced text formatting
- Custom brush types
- Animation support
