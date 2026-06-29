import React, { useState, useEffect, useRef } from 'react';
import './WelcomeScreen.css';

const WelcomeScreen = ({ onEnter }) => {
    const [holding, setHolding] = useState(false);
    const [progress, setProgress] = useState(0);
    const holdTimer = useRef(null);
    const startTime = useRef(null);
    const REQUIRED_HOLD = 10000; // 10 seconds

    const startHold = (e) => {
        e.preventDefault();
        setHolding(true);
        startTime.current = Date.now();

        holdTimer.current = setInterval(() => {
            const elapsed = Date.now() - startTime.current;
            const pct = Math.min((elapsed / REQUIRED_HOLD) * 100, 100);
            setProgress(pct);

            if (elapsed >= REQUIRED_HOLD) {
                clearInterval(holdTimer.current);
                onEnter?.();
            }
        }, 50);
    };

    const stopHold = () => {
        setHolding(false);
        setProgress(0);
        if (holdTimer.current) {
            clearInterval(holdTimer.current);
            holdTimer.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (holdTimer.current) clearInterval(holdTimer.current);
        };
    }, []);

    return (
        <div className="welcome-screen">
            <img
                src="/welcome.png"
                alt="Welcome"
                className="welcome-image"
                draggable="false"
            />

            <div
                className="welcome-overlay"
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                onContextMenu={(e) => e.preventDefault()}
            >
                <div className="welcome-content">
                    <h1 className="welcome-title">💕 Welcome</h1>

                    {!holding ? (
                        <p className="welcome-hint">
                            Press and hold anywhere to enter
                        </p>
                    ) : (
                        <div className="progress-container">
                            <div className="progress-ring">
                                <svg viewBox="0 0 100 100">
                                    <circle
                                        className="progress-bg"
                                        cx="50" cy="50" r="42"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeWidth="6"
                                    />
                                    <circle
                                        className="progress-fill"
                                        cx="50" cy="50" r="42"
                                        fill="none"
                                        stroke="#ff4081"
                                        strokeWidth="6"
                                        strokeDasharray={`${(progress / 100) * 264} 264`}
                                        strokeLinecap="round"
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <span className="progress-text">
                                    {Math.floor(progress)}%
                                </span>
                            </div>
                            <p className="holding-text">Keep holding...</p>
                        </div>
                    )}

                    <p className="welcome-subtitle">
                        Secure • Private • Just Us
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;