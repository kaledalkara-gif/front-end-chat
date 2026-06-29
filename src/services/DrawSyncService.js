export class DrawSyncService {
    constructor() {
        this.drawings = [];
        this.currentColor = '#ff4081';
        this.currentSize = 4;
        this.isDrawing = false;

        this.onDrawingReceived = null;
        this.onClearCanvas = null;
    }

    setColor(color) {
        this.currentColor = color;
    }

    setSize(size) {
        this.currentSize = Math.max(1, Math.min(20, size));
    }

    addStroke(points, color, size) {
        const stroke = { points, color, size, id: Date.now() };
        this.drawings.push(stroke);
        return stroke;
    }

    receiveStroke(stroke) {
        this.drawings.push(stroke);
        this.onDrawingReceived?.(stroke);
    }

    clearCanvas() {
        this.drawings = [];
        this.onClearCanvas?.();
    }

    getAllDrawings() {
        return [...this.drawings];
    }

    cleanup() {
        this.drawings = [];
        this.isDrawing = false;
    }
}

// Pretty colors for drawing
export const DRAW_COLORS = [
    '#ff4081', // Pink
    '#ff1744', // Red
    '#ff9800', // Orange
    '#ffeb3b', // Yellow
    '#4caf50', // Green
    '#2196f3', // Blue
    '#9c27b0', // Purple
    '#ffffff', // White
    '#00bcd4', // Cyan
    '#ff6d75', // Coral
];

export const BRUSH_SIZES = [2, 4, 6, 8, 12, 16];