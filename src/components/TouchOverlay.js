import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TOUCH_PATTERNS } from '../services/HapticService';
import './TouchOverlay.css';

const TouchOverlay = ({ onTouchSend, receivedTouches, isVisible }) => {
    const [hasTouched, setHasTouched] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState('touch');
    const [showPicker, setShowPicker] = useState(false);

    // High-performance local state pool to handle ripples without direct DOM injections
    const [localRipples, setLocalRipples] = useState([]);

    const overlayRef = useRef(null);
    const isMouseDownRef = useRef(false);
    const hintHiddenRef = useRef(false);

    // High-Performance Ripple Factory
    const createRipple = useCallback((x, y) => {
        const rippleId = `${Date.now()}-${Math.random()}`;
        const newRipple = {
            id: rippleId,
            x,
            y,
            color: TOUCH_PATTERNS[selectedPattern]?.color || '#fff'
        };

        setLocalRipples(prev => [...prev, newRipple]);

        // Clean up memory after animation finishes
        setTimeout(() => {
            setLocalRipples(prev => prev.filter(r => r.id !== rippleId));
        }, 800);
    }, [selectedPattern]);

    // Unified Pointer Interaction Core Logic
    const handleTouch = useCallback((e) => {
        if (!isVisible) return;

        // Prevent default scrolling only during active overlay interactions
        if (e.cancelable) e.preventDefault();

        // FIXED: Prevent state re-render floods during rapid sliding interactions
        if (!hintHiddenRef.current) {
            hintHiddenRef.current = true;
            setHasTouched(true);
        }

        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Support both mobile touch vectors and desktop click profiles adaptively
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const localX = clientX - rect.left;
        const localY = clientY - rect.top;

        // Calculate standardized relative positioning coordinates (0.0 to 1.0)
        const x = Math.max(0, Math.min(1, localX / rect.width));
        const y = Math.max(0, Math.min(1, localY / rect.height));

        onTouchSend?.({
            x,
            y,
            pattern: selectedPattern,
            timestamp: Date.now(),
        });

        createRipple(localX, localY);
    }, [isVisible, selectedPattern, onTouchSend, createRipple]);

    // Desktop Mouse Drag Controllers
    const handleMouseDown = (e) => {
        isMouseDownRef.current = true;
        handleTouch(e);
    };

    const handleMouseMove = (e) => {
        if (!isMouseDownRef.current) return;
        handleTouch(e);
    };

    useEffect(() => {
        const handleMouseUp = () => { isMouseDownRef.current = false; };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="touch-overlay-container">
            {/* Received touches from partner */}
            {receivedTouches.map((touch) => (
                <div
                    key={touch.id}
                    className="received-touch"
                    style={{
                        left: `${touch.x * 100}%`,
                        top: `${touch.y * 100}%`,
                        animationDuration: `${TOUCH_PATTERNS[touch.pattern]?.duration || 1000}ms`,
                    }}
                >
                    <span className="touch-emoji">
                        {TOUCH_PATTERNS[touch.pattern]?.emoji || '❤️'}
                    </span>
                    <div
                        className="touch-glow"
                        style={{
                            borderColor: TOUCH_PATTERNS[touch.pattern]?.color || '#fff',
                            width: `${TOUCH_PATTERNS[touch.pattern]?.size || 30}px`,
                            height: `${TOUCH_PATTERNS[touch.pattern]?.size || 30}px`,
                        }}
                    />
                </div>
            ))}

            {/* High-Performance React Local Ripples Layout Mapper */}
            {localRipples.map(ripple => (
                <div
                    key={ripple.id}
                    className="touch-ripple"
                    style={{
                        position: 'absolute',
                        left: `${ripple.x}px`,
                        top: `${ripple.y}px`,
                        borderColor: ripple.color,
                        pointerEvents: 'none'
                    }}
                />
            ))}

            {/* Touch-sensitive interactive window area */}
            <div
                ref={overlayRef}
                className={`touch-area ${hasTouched ? 'touched' : ''}`}
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
            >
                <div className="touch-hint">
                    <span>Touch here to feel each other</span>
                    <span className="hint-icon">👆</span>
                </div>
            </div>

            {/* Gesture Picker Button */}
            <button
                className="gesture-picker-btn"
                onClick={() => setShowPicker(!showPicker)}
                style={{ background: TOUCH_PATTERNS[selectedPattern]?.color || '#666' }}
            >
                {TOUCH_PATTERNS[selectedPattern]?.emoji || '👆'}
                <span>{TOUCH_PATTERNS[selectedPattern]?.label || 'Touch'}</span>
            </button>

            {/* Gesture Selection Picker Dropdown Overlay */}
            {showPicker && (
                <div className="gesture-picker">
                    {Object.entries(TOUCH_PATTERNS).map(([key, pattern]) => (
                        <button
                            key={key}
                            className={`gesture-option ${selectedPattern === key ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedPattern(key);
                                setShowPicker(false);
                            }}
                            style={{
                                borderColor: selectedPattern === key ? pattern.color : 'transparent',
                            }}
                        >
                            <span className="gesture-emoji">{pattern.emoji}</span>
                            <span className="gesture-label">{pattern.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TouchOverlay;
