import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DrawSyncService, DRAW_COLORS, BRUSH_SIZES } from '../services/DrawSyncService';
import './DrawCanvas.css';

const DrawCanvas = ({ isVisible, drawService, onSendStroke, onClearCanvas, receivedStrokes }) => {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [currentColor, setCurrentColor] = useState('#ff4081');
    const [currentSize, setCurrentSize] = useState(4);
    const [showTools, setShowTools] = useState(true);

    // Use refs to track current drawing state dynamically without breaking useCallback closures
    const stateRef = useRef({
        points: [],
        color: '#ff4081',
        size: 4,
        lastX: 0,
        lastY: 0
    });

    // Sync React state to tracking refs immediately
    useEffect(() => {
        stateRef.current.color = currentColor;
        stateRef.current.size = currentSize;
    }, [currentColor, currentSize]);

    // Decoupled redraw function
    const redrawAll = useCallback(() => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawService?.getAllDrawings().forEach(stroke => drawStroke(stroke));
    }, [drawService]);

    // Decoupled single-stroke draw function
    const drawStroke = useCallback((stroke) => {
        const ctx = ctxRef.current;
        if (!ctx || !stroke.points || stroke.points.length < 2) return;

        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    }, []);

    // Handle Canvas Initialization and Resizing (Supports HDPI/Retina displays)
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !isVisible) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');
        ctxRef.current = ctx;

        const handleResize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Set physical buffer size adjusted for screen resolution
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            // Normalize context coordinate system back to matching CSS dimensions
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Redraw data because structural resize inherently clears the canvas
            redrawAll();
        };

        // Initialize dimensions
        handleResize();

        // Dynamically monitor window changes
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isVisible, redrawAll]);

    // Hook into incoming strokes
    useEffect(() => {
        if (receivedStrokes?.length > 0) {
            const latestStroke = receivedStrokes[receivedStrokes.length - 1];
            if (latestStroke) {
                drawStroke(latestStroke);
            }
        }
    }, [receivedStrokes, drawStroke]);

    // Precise coordinate parsing matching scaled boundaries
    const getPosition = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }, []);

    const startDrawing = useCallback((e) => {
        // Leave room for natural panning behavior on touch devices unless explicitly interacting
        if (!e.touches) e.preventDefault();

        setIsDrawing(true);
        const point = getPosition(e);

        stateRef.current.points = [point];
        stateRef.current.lastX = point.x;
        stateRef.current.lastY = point.y;
    }, [getPosition]);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        if (!e.touches) e.preventDefault();

        const point = getPosition(e);
        const state = stateRef.current;

        state.points.push(point);

        const ctx = ctxRef.current;
        if (ctx) {
            ctx.beginPath();
            ctx.strokeStyle = state.color;
            ctx.lineWidth = state.size;
            ctx.moveTo(state.lastX, state.lastY);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
        }

        state.lastX = point.x;
        state.lastY = point.y;
    }, [isDrawing, getPosition]);

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);

        const state = stateRef.current;
        if (state.points.length > 1) {
            const stroke = {
                points: [...state.points],
                color: state.color,
                size: state.size,
                id: Date.now()
            };

            drawService?.addStroke(state.points, state.color, state.size);
            onSendStroke?.(stroke);
        }
        state.points = [];
    }, [isDrawing, drawService, onSendStroke]);

    const handleClear = () => {
        const ctx = ctxRef.current;
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        drawService?.clearCanvas();
        onClearCanvas?.();
    };

    if (!isVisible) return null;

    return (
        <div ref={containerRef} className="draw-container">
            <canvas
                ref={canvasRef}
                className="draw-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />

            {showTools && (
                <div className="draw-toolbar">
                    <button className="draw-tool-btn" onClick={() => setShowTools(false)} title="Hide tools">
                        ◀
                    </button>

                    <div className="draw-colors">
                        {DRAW_COLORS.map(color => (
                            <button
                                key={color}
                                className={`draw-color-btn ${currentColor === color ? 'active' : ''}`}
                                style={{ background: color }}
                                onClick={() => {
                                    setCurrentColor(color);
                                    drawService?.setColor(color);
                                }}
                            />
                        ))}
                    </div>

                    <div className="draw-sizes">
                        {BRUSH_SIZES.map(size => (
                            <button
                                key={size}
                                className={`draw-size-btn ${currentSize === size ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentSize(size);
                                    drawService?.setSize(size);
                                }}
                            >
                                <span style={{ width: size, height: size, background: currentColor }} />
                            </button>
                        ))}
                    </div>

                    <button className="draw-action-btn" onClick={handleClear} title="Clear all">
                        🗑
                    </button>
                </div>
            )}

            {!showTools && (
                <button className="draw-tool-toggle" onClick={() => setShowTools(true)}>
                    🎨
                </button>
            )}

            <button className="draw-toggle-btn" onClick={() => onSendStroke?.(null)} title="Drawing Mode">
                Stop Drawing ✋ 🎨
            </button>
        </div>
    );
};

export default DrawCanvas;
