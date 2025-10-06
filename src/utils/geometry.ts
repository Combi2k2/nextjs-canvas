import { Annotation, SelectionRect } from '@/types/annotations';

export const isPointInAnnotation = (x: number, y: number, annotation: Annotation): boolean => {
    if (annotation.type === 'stroke') {
        for (let i = 0; i < annotation.points.length - 2; i += 2) {
            const dist = Math.sqrt(
                Math.pow(x - annotation.points[i], 2) + 
                Math.pow(y - annotation.points[i + 1], 2)
            );
            if (dist < 10) return true;
        }
    } else if (annotation.type === 'shape') {
        if (annotation.shapeType === 'ellipse') {
            const centerX = annotation.x + annotation.width / 2;
            const centerY = annotation.y + annotation.height / 2;
            const radius = Math.max(annotation.width, annotation.height) / 2;
            const dist = Math.sqrt(
                Math.pow(x - centerX, 2) + 
                Math.pow(y - centerY, 2)
            );
            return Math.abs(dist - radius) < 10;
        } else if (annotation.shapeType === 'rectangle') {
            return x >= annotation.x && 
                x <= annotation.x + annotation.width &&
                y >= annotation.y && 
                y <= annotation.y + annotation.height;
        } else if (annotation.shapeType === 'line') {
            const points = annotation.points || [];
            if (points.length >= 4) {
                const dist = distanceToLineSegment(
                        x, y, 
                        points[0], points[1], 
                        points[2], points[3]
                );
                return dist < 10;
            }
        } else if (annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline') {
            const points = annotation.points || [];
            if (points.length >= 6) {
                    // Check if point is near any line segment of the polygon/polyline
                for (let i = 0; i < points.length - 2; i += 2) {
                    const dist = distanceToLineSegment(
                        x, y,
                        points[i], points[i + 1],
                        points[i + 2], points[i + 3]
                    );
                    if (dist < 10) return true;
                }
                    
                // For polygon, check the closing line from last point to first point
                if (annotation.shapeType === 'polygon' && points.length >= 6) {
                    const dist = distanceToLineSegment(
                        x, y,
                        points[points.length - 2], points[points.length - 1],
                        points[0], points[1]
                    );
                    if (dist < 10) return true;
                }
            }
        }
    } else if (annotation.type === 'text') {
        return x >= annotation.x && 
            x <= annotation.x + annotation.width && 
            y >= annotation.y && 
            y <= annotation.y + annotation.height;
    } else if (annotation.type === 'image') {
        return x >= annotation.x && 
            x <= annotation.x + annotation.width && 
            y >= annotation.y && 
            y <= annotation.y + annotation.height;
    }
    return false;
};

export const distanceToLineSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
            xx = x1;
            yy = y1;
    } else if (param > 1) {
            xx = x2;
            yy = y2;
    } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
    }
    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
};

export const isAnnotationInRect = (annotation: Annotation, rect: SelectionRect): boolean => {
    const minX = Math.min(rect.x, rect.x + rect.width);
    const maxX = Math.max(rect.x, rect.x + rect.width);
    const minY = Math.min(rect.y, rect.y + rect.height);
    const maxY = Math.max(rect.y, rect.y + rect.height);
    
    if (annotation.type === 'stroke') {
        return annotation.points.some((p, i) => {
            if (i % 2 === 0) {
                const x = annotation.points[i];
                const y = annotation.points[i + 1];
                return x >= minX && x <= maxX && y >= minY && y <= maxY;
            }
            return false;
        });
    } else if (annotation.type === 'text' || annotation.type === 'image') {
        return annotation.x >= minX && 
            annotation.x <= maxX && 
            annotation.y >= minY && 
            annotation.y <= maxY;
    } else if (annotation.type === 'shape') {
        return annotation.x >= minX && 
            annotation.x <= maxX && 
            annotation.y >= minY && 
            annotation.y <= maxY;
    }
    return false;
};

export const isAnnotationInEraserCircle = (x: number, y: number, eraserRadius: number, annotation: Annotation): boolean => {
    if (annotation.type === 'stroke') {
        // Check if any point of the stroke is within the eraser circle
        for (let i = 0; i < annotation.points.length - 2; i += 2) {
            const dist = Math.sqrt(
                Math.pow(x - annotation.points[i], 2) + 
                Math.pow(y - annotation.points[i + 1], 2)
            );
            if (dist < eraserRadius) return true;
        }
    } else if (annotation.type === 'shape') {
        if (annotation.shapeType === 'ellipse') {
            const centerX = annotation.x + annotation.width / 2;
            const centerY = annotation.y + annotation.height / 2;
            const radiusX = annotation.width / 2;
            const radiusY = annotation.height / 2;
            const dist = Math.sqrt(
                Math.pow(x - centerX, 2) + 
                Math.pow(y - centerY, 2)
            );
            // Check if eraser circle intersects with ellipse
            return dist < (eraserRadius + Math.max(radiusX, radiusY));
        } else if (annotation.shapeType === 'rectangle') {
            // Check if eraser circle intersects with rectangle
            const closestX = Math.max(annotation.x, Math.min(x, annotation.x + annotation.width));
            const closestY = Math.max(annotation.y, Math.min(y, annotation.y + annotation.height));
            const dist = Math.sqrt(
                Math.pow(x - closestX, 2) + 
                Math.pow(y - closestY, 2)
            );
            return dist < eraserRadius;
        } else if (annotation.shapeType === 'line') {
            const points = annotation.points || [];
            if (points.length >= 4) {
                const dist = distanceToLineSegment(
                    x, y, 
                    points[0], points[1], 
                    points[2], points[3]
                );
                return dist < eraserRadius;
            }
        } else if (annotation.shapeType === 'polygon' || annotation.shapeType === 'polyline') {
            const points = annotation.points || [];
            if (points.length >= 6) {
                // Check if eraser circle intersects with any line segment
                for (let i = 0; i < points.length - 2; i += 2) {
                    const dist = distanceToLineSegment(
                        x, y,
                        points[i], points[i + 1],
                        points[i + 2], points[i + 3]
                    );
                    if (dist < eraserRadius) return true;
                }
                
                // For polygon, check the closing line from last point to first point
                if (annotation.shapeType === 'polygon' && points.length >= 6) {
                    const dist = distanceToLineSegment(
                        x, y,
                        points[points.length - 2], points[points.length - 1],
                        points[0], points[1]
                    );
                    if (dist < eraserRadius) return true;
                }
            }
        }
    } else if (annotation.type === 'text') {
        // Check if eraser circle intersects with text rectangle
        const closestX = Math.max(annotation.x, Math.min(x, annotation.x + annotation.width));
        const closestY = Math.max(annotation.y, Math.min(y, annotation.y + annotation.height));
        const dist = Math.sqrt(
            Math.pow(x - closestX, 2) + 
            Math.pow(y - closestY, 2)
        );
        return dist < eraserRadius;
    } else if (annotation.type === 'image') {
        // Check if eraser circle intersects with image rectangle
        const closestX = Math.max(annotation.x, Math.min(x, annotation.x + annotation.width));
        const closestY = Math.max(annotation.y, Math.min(y, annotation.y + annotation.height));
        const dist = Math.sqrt(
            Math.pow(x - closestX, 2) + 
            Math.pow(y - closestY, 2)
        );
        return dist < eraserRadius;
    }
    return false;
};