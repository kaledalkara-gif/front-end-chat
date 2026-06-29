import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { PLAYLIST } from '../services/MusicSyncService';
import './MusicPlayer.css';

// --- SUB-COMPONENT: CONTROLS ---
const PlayerControls = ({ isPlaying, volume, onPause, onResume, onStop, onVolumeChange, onTogglePlaylist }) => {
    if (!isPlaying) {
        return (
            <button
                className="music-btn play-btn"
                onClick={onTogglePlaylist}
                aria-label="Choose Music"
            >
                Choose Music 🎵
            </button>
        );
    }

    return (
        <>
            <button
                className="music-btn"
                onClick={onPause}
                aria-label={isPlaying ? "Pause music" : "Play music"}
            >
                {isPlaying ? '⏸' : '▶'}
            </button>
            <button
                className="music-btn"
                onClick={onStop}
                aria-label="Stop music"
            >
                ⏹
            </button>
            <div className="volume-slider">
                <span id="volume-label" aria-hidden="true">🔊</span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={onVolumeChange}
                    className="volume-input"
                    aria-labelledby="volume-label"
                />
            </div>
            <button
                className="music-btn"
                onClick={onTogglePlaylist}
                aria-label="Open playlist"
            >
                🎵
            </button>
        </>
    );
};

// --- SUB-COMPONENT: CUSTOM URL FORM ---
const CustomTrackForm = ({ onPlayCustom }) => {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customUrl, setCustomUrl] = useState('');
    const [customName, setCustomName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!customUrl.trim()) return;

        onPlayCustom(customUrl.trim(), customName.trim());
        setCustomUrl('');
        setCustomName('');
        setShowCustomInput(false);
    };

    if (!showCustomInput) {
        return (
            <button className="custom-url-btn" onClick={() => setShowCustomInput(true)}>
                Add Your Own Song URL 🔗
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="custom-url-inputs">
            <label htmlFor="custom-url-field" className="sr-only">Paste song URL here</label>
            <input
                id="custom-url-field"
                type="text"
                placeholder="Paste song URL here..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="url-input"
                autoFocus
                required
            />

            <label htmlFor="custom-name-field" className="sr-only">Song name (optional)</label>
            <input
                id="custom-name-field"
                type="text"
                placeholder="Song name (optional)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="name-input"
            />

            <div className="custom-url-actions">
                <button type="submit" className="btn-play-custom">Play ▶</button>
                <button type="button" className="btn-cancel-custom" onClick={() => setShowCustomInput(false)}>
                    Cancel
                </button>
            </div>
            <p className="url-hint">
                Paste a direct MP3 💡 link. You can find free music at:
                <br />
                <a href="https://pixabay.com" target="_blank" rel="noreferrer">://pixabay.com</a> •
                <a href="https://chosic.com" target="_blank" rel="noreferrer">chosic.com</a>
            </p>
        </form>
    );
};

// --- MAIN MUSIC PLAYER COMPONENT ---
const MusicPlayer = ({ isVisible, musicService, isConnected }) => {
    // Consolidated Playback State
    const [playback, setPlayback] = useState({
        selectedTrackId: null,
        isPlaying: false,
        currentTrackName: '',
    });

    const [volume, setVolume] = useState(30);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Ref to track the current active request ID to completely eliminate race conditions
    const loadingRequestId = useRef(0);

    // Memoize categories calculation so it only runs once
    const categories = useMemo(() => [...new Set(PLAYLIST.map(t => t.category))], []);

    // Sync initial service volume if musicService mounts or changes
    useEffect(() => {
        if (musicService) {
            musicService.setVolume(volume / 100);
        }
    }, [musicService, volume]);

    const playTrack = useCallback(async (url, name, id, emoji = '🎵') => {
        if (!musicService) return;

        // Increment request ID to invalidate any prior, pending async requests
        const currentId = ++loadingRequestId.current;
        setIsLoading(true);

        try {
            const startTime = await musicService.playTrack(url, name);

            // If a newer request was made while awaiting this one, abort updating state
            if (currentId !== loadingRequestId.current) return;

            if (startTime) {
                setPlayback({
                    selectedTrackId: id,
                    isPlaying: true,
                    currentTrackName: `${emoji} ${name}`,
                });
            }
        } catch (error) {
            console.error("Failed to play track:", error);
        } finally {
            if (currentId === loadingRequestId.current) {
                setIsLoading(false);
            }
        }
    }, [musicService]);

    const handlePlayPreset = useCallback((track) => {
        playTrack(track.url, track.name, track.id, track.emoji);
    }, [playTrack]);

    const handlePlayCustom = useCallback((url, explicitName) => {
        const finalName = explicitName || 'My Song';
        playTrack(url, finalName, 'custom', '🎵');
    }, [playTrack]);

    const handlePause = useCallback(() => {
        musicService?.pause();
        setPlayback(prev => ({ ...prev, isPlaying: false }));
    }, [musicService]);

    const handleResume = useCallback(() => {
        musicService?.resume();
        setPlayback(prev => ({ ...prev, isPlaying: true }));
    }, [musicService]);

    const handleStop = useCallback(() => {
        musicService?.stop();
        // Invalidate any active, lingering loading track requests
        loadingRequestId.current++;
        setIsLoading(false);
        setPlayback({
            selectedTrackId: null,
            isPlaying: false,
            currentTrackName: '',
        });
    }, [musicService]);

    const handleVolumeChange = useCallback((e) => {
        const vol = parseInt(e.target.value, 10);
        setVolume(vol);
        musicService?.setVolume(vol / 100);
    }, [musicService]);

    const togglePlaylist = useCallback(() => {
        setShowPlaylist(prev => !prev);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="music-player-container">
            {/* Loading Overlay state */}
            {isLoading && <div className="player-loading-spinner" aria-busy="true">Loading Track...</div>}

            {/* Now Playing Bar */}
            {playback.currentTrackName && (
                <div className="now-playing">
                    <span className="playing-dot"></span>
                    <span className="track-name">{playback.currentTrackName}</span>
                </div>
            )}

            {/* Controls Container */}
            <div className="music-controls">
                <PlayerControls
                    isPlaying={playback.isPlaying}
                    volume={volume}
                    onPause={handlePause}
                    onResume={handleResume}
                    onStop={handleStop}
                    onVolumeChange={handleVolumeChange}
                    onTogglePlaylist={togglePlaylist}
                />
            </div>

            {/* Playlist Modal */}
            {showPlaylist && (
                <>
                    <div className="playlist-overlay" onClick={() => setShowPlaylist(false)} />
                    <div className="playlist-modal" role="dialog" aria-modal="true" aria-label="Choose Music">
                        <h3>Choose Music 🎵</h3>

                        <div className="custom-url-section">
                            <CustomTrackForm onPlayCustom={handlePlayCustom} />
                        </div>

                        <div className="section-title">🎧 Preset Playlist</div>
                        {categories.map(cat => (
                            <div key={cat} className="playlist-category">
                                <div className="category-title">{cat}</div>
                                {PLAYLIST.filter(t => t.category === cat).map(track => {
                                    const isCurrent = playback.selectedTrackId === track.id;
                                    return (
                                        <div
                                            key={track.id}
                                            className={`playlist-item ${isCurrent ? 'selected' : ''}`}
                                            onClick={() => handlePlayPreset(track)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlayPreset(track); }}
                                        >
                                            <span className="track-emoji" aria-hidden="true">{track.emoji}</span>
                                            <span className="track-label">{track.name}</span>
                                            {isCurrent && playback.isPlaying && (
                                                <span className="playing-indicator" aria-label="Currently playing"> ▶ </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        <button className="close-playlist" onClick={() => setShowPlaylist(false)}>
                            Close ✕
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default MusicPlayer;
