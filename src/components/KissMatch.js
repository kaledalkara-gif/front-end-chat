import React, { useEffect, useState } from 'react';
import './KissMatch.css';

// Static spark mapping outside render loop - prevents garbage collection spikes
const SPARK_PARTICLES = [...Array(12)];

// Pre-defined colors and emojis - no inline array creation
const HEART_COLORS = ['#ff4081', '#ff6d75', '#ff1744', '#f50057', '#ff80ab'];
const HEART_EMOJIS = ['💕', '💖', '💘', '💝', '✨', '💫', '❤️'];

const KissMatch = ({ match, onComplete }) => {
    const [phase, setPhase] = useState('spark');
    const [hearts, setHearts] = useState([]);

    useEffect(() => {
        // Safety guard: Exit if no match data
        if (!match) return;

        // Generate floating hearts once
        const newHearts = [];
        for (let i = 0; i < 20; i++) {
            newHearts.push({
                id: i,
                x: Math.random() * 100 - 50,
                y: -(Math.random() * 100 + 50),
                size: Math.random() * 20 + 10,
                delay: Math.random() * 0.5,
                color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
                emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
            });
        }
        setHearts(newHearts);

        // Capture timer references for cleanup
        const timer1 = setTimeout(() => setPhase('explosion'), 300);
        const timer2 = setTimeout(() => setPhase('hearts'), 600);
        const timer3 = setTimeout(() => {
            if (onComplete) onComplete();
        }, 3000);

        // Cleanup: Clear all timers if component unmounts mid-animation
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [match, onComplete]);

    // Safety check at render level
    if (!match) return null;

    return (
        <div
            className={`kiss-match-container phase-${phase}`}
            style={{
                left: `${match.x * 100}%`,
                top: `${match.y * 100}%`,
            }}
        >
            {/* Center explosion */}
            <div className="kiss-explosion">
                <div className="explosion-ring ring-1" />
                <div className="explosion-ring ring-2" />
                <div className="explosion-ring ring-3" />
                <div className="explosion-core">💋</div>
            </div>

            {/* Floating hearts */}
            {hearts.map((heart) => (
                <div
                    key={heart.id}
                    className="floating-heart"
                    style={{
                        '--x': `${heart.x}px`,
                        '--y': `${heart.y}px`,
                        '--size': `${heart.size}px`,
                        '--delay': `${heart.delay}s`,
                        '--color': heart.color,
                    }}
                >
                    {heart.emoji}
                </div>
            ))}

            {/* Sparkle particles - using static array */}
            {SPARK_PARTICLES.map((_, i) => (
                <div
                    key={`spark-${i}`}
                    className="spark-particle"
                    style={{
                        '--angle': `${i * 30}deg`,
                        '--distance': `${Math.random() * 60 + 30}px`,
                        '--delay': `${Math.random() * 0.3}s`,
                    }}
                />
            ))}
        </div>
    );
};

export default KissMatch;