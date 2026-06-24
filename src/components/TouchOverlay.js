import React, { useState, useRef, useCallback } from 'react';
import { TOUCH_PATTERNS } from '../services/HapticService';
import './TouchOverlay.css';

const TouchOverlay = ({ onTouchSend, receivedTouches, isVisible }) => {
    const [hasTouched, setHasTouched] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState('touch');
    const [showPicker, setShowPicker] = useState(false);
    const overlayRef = useRef(null);

    // When user touches the overlay
    const handleTouch = useCallback((e) => {
        if (!isVisible) return;
        e.preventDefault();

        // Hide hint after first touch
        if (!hasTouched) setHasTouched(true);

        const touch = e.touches ? e.touches[0] : e;
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate relative position (0 to 1)
        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;

        // Send touch event to partner
        onTouchSend?.({
            x,
            y,
            pattern: selectedPattern,
            timestamp: Date.now(),
        });

        // Create local ripple effect
        createRipple(touch.clientX - rect.left, touch.clientY - rect.top);
    }, [isVisible, selectedPattern, onTouchSend]);

    // Ripple effect on touch
    const createRipple = (x, y) => {
        const ripple = document.createElement('div');
        ripple.className = 'touch-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.style.borderColor = TOUCH_PATTERNS[selectedPattern]?.color || '#fff';
        overlayRef.current?.appendChild(ripple);

        setTimeout(() => ripple.remove(), 800);
    };

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
                        {TOUCH_PATTERNS[touch.pattern]?.emoji || '💗'}
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

            {/* Touch-sensitive area */}
            <div
                ref={overlayRef}
                className={`touch-area ${hasTouched ? 'touched' : ''}`}
                onTouchStart={handleTouch}
                onTouchMove={handleTouch}
                onMouseDown={handleTouch}
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

            {/* Gesture Picker */}
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