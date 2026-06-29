import React, { useState, useEffect, useCallback } from 'react';
import './LoveNotes.css';

const LOVE_COLORS = ['#ff4081', '#ff6d75', '#ff1744', '#f50057', '#ff80ab', '#e040fb', '#7c4dff'];
const LOVE_EMOJIS = ['💕', '💖', '💘', '💝', '✨', '💫', '❤', '💗', '💓', '💞'];

const LoveNotes = ({ isVisible, onSendNote, receivedNotes }) => {
    const [showInput, setShowInput] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [floatingNotes, setFloatingNotes] = useState([]);

    // Track already-displayed note IDs cleanly without mutating props directly
    const [displayedNoteIds, setDisplayedNoteIds] = useState(new Set());

    // Handle Note Generation
    const addFloatingNote = useCallback((text, color, isMine) => {
        const id = `${Date.now()}-${Math.random()}`;
        const note = {
            id,
            text,
            color,
            isMine,
            emoji: LOVE_EMOJIS[Math.floor(Math.random() * LOVE_EMOJIS.length)],
            startY: Math.random() * 40 + 30, // 30% to 70% height placement
            duration: Math.random() * 2 + 4, // 4 to 6 seconds flight path duration
        };

        setFloatingNotes(prev => [...prev.slice(-9), note]); // Keep up to 10 active items maximum
    }, []);

    // Safe ingestion of incoming notes without data mutation
    useEffect(() => {
        if (receivedNotes && receivedNotes.length > 0) {
            const latestNote = receivedNotes[receivedNotes.length - 1];

            // Verify via an independent fallback ID or string reference mapping
            const noteIdentifier = latestNote.id || latestNote.text + latestNote.color;

            if (latestNote && !displayedNoteIds.has(noteIdentifier)) {
                setDisplayedNoteIds(prev => {
                    const next = new Set(prev);
                    next.add(noteIdentifier);
                    return next;
                });

                addFloatingNote(latestNote.text, latestNote.color, false);
            }
        }
    }, [receivedNotes, displayedNoteIds, addFloatingNote]);

    // Handle removing a note safely via a native DOM animation event callback
    const handleAnimationEnd = useCallback((id) => {
        setFloatingNotes(prev => prev.filter(note => note.id !== id));
    }, []);

    const handleSend = () => {
        const trimmed = noteText.trim();
        if (!trimmed) return;

        const chosenColor = LOVE_COLORS[Math.floor(Math.random() * LOVE_COLORS.length)];

        // Render immediately locally
        addFloatingNote(trimmed, chosenColor, true);

        // Bubble up data cleanly to the parent wrapper engine
        onSendNote?.({ text: trimmed, color: chosenColor });

        setNoteText('');
        setShowInput(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    if (!isVisible) return null;

    return (
        <div className="love-notes-container">
            {/* Floating Canvas Elements */}
            <div className="love-notes-canvas" aria-live="polite">
                {floatingNotes.map(note => (
                    <div
                        key={note.id}
                        className={`love-note ${note.isMine ? 'sent' : 'received'}`}
                        onAnimationEnd={() => handleAnimationEnd(note.id)}
                        style={{
                            '--start-y': `${note.startY}%`,
                            '--duration': `${note.duration}s`,
                            '--color': note.color,
                        }}
                    >
                        <span className="note-emoji" aria-hidden="true">{note.emoji}</span>
                        <span className="note-text">{note.text}</span>
                        <span className="note-emoji" aria-hidden="true">{note.emoji}</span>
                    </div>
                ))}
            </div>

            {/* Input Action Panel Block */}
            {!showInput ? (
                <button
                    className="love-note-trigger"
                    onClick={() => setShowInput(true)}
                    aria-label="Write a love note"
                >
                    💌
                </button>
            ) : (
                <div className="love-note-input-container">
                    <label htmlFor="love-note-field" className="sr-only">Type your love note</label>
                    <input
                        id="love-note-field"
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value.slice(0, 50))}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a love note... 💕"
                        className="love-note-input"
                        maxLength={50}
                        autoFocus
                    />
                    <span className="char-count" aria-live="polite">
                        {noteText.length} / 50
                    </span>
                    <div className="love-note-actions">
                        <button className="btn-send-note" onClick={handleSend} aria-label="Send love note">
                            Send 💌
                        </button>
                        <button
                            className="btn-cancel-note"
                            onClick={() => { setShowInput(false); setNoteText(''); }}
                            aria-label="Cancel note creation"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoveNotes;
