import React, { useEffect, useState } from 'react';
import './KissMatch.css';

const KissMatch = ({ match, onComplete }) => {
    const [phase, setPhase] = useState('spark');
    const [hearts, setHearts] = useState([]);

    useEffect(() => {
        // Generate floating hearts
        const newHearts = [];
        for (let i = 0; i < 20; i++) {
            newHearts.push({
                id: i,
                x: Math.random() * 100 - 50,
                y: -(Math.random() * 100 + 50),
                size: Math.random() * 20 + 10,
                delay: Math.random() * 0.5,
                color: ['#ff4081', '#ff6d75', '#ff1744', '#f50057', '#ff80ab'][Math.floor(Math.random() * 5)],
                emoji: ['💕', '💖', '💘', '💝', '✨', '💫', '❤️'][Math.floor(Math.random() * 7)],
            });
        }
        setHearts(newHearts);

        // Animation phases
        setTimeout(() => setPhase('explosion'), 300);
        setTimeout(() => setPhase('hearts'), 600);
        setTimeout(() => onComplete?.(), 3000);
    }, [onComplete]);

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

            {/* Sparkle particles */}
            {[...Array(12)].map((_, i) => (
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