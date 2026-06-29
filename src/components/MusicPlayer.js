import React, { useState } from 'react';
import { PLAYLIST } from '../services/MusicSyncService';
import './MusicPlayer.css';

const MusicPlayer = ({ isVisible, musicService, isConnected }) => {
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(30);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [currentTrackName, setCurrentTrackName] = useState('');

    if (!isVisible) return null;

    const handlePlayTrack = async (track) => {
        const startTime = await musicService?.playTrack(track.url, track.name);
        if (startTime) {
            setSelectedTrack(track);
            setIsPlaying(true);
            setCurrentTrackName(track.name);
            // Send sync signal to partner
            if (isConnected) {
                const syncData = {
                    type: 'music-sync',
                    action: 'play',
                    track: track,
                    startTime: startTime,
                };
                // Send via WebRTCService
            }
        }
    };

    const handlePause = () => {
        musicService?.pause();
        setIsPlaying(false);
    };

    const handleResume = () => {
        musicService?.resume();
        setIsPlaying(true);
    };

    const handleVolumeChange = (e) => {
        const vol = parseInt(e.target.value);
        setVolume(vol);
        musicService?.setVolume(vol / 100);
    };

    const handleStop = () => {
        musicService?.stop();
        setIsPlaying(false);
        setSelectedTrack(null);
        setCurrentTrackName('');
    };

    const categories = [...new Set(PLAYLIST.map(t => t.category))];

    return (
        <div className="music-player-container">
            {/* Now Playing */}
            {currentTrackName && (
                <div className="now-playing">
                    <span className="music-icon">🎵</span>
                    <span className="track-name">{currentTrackName}</span>
                    <span className="playing-dot"></span>
                </div>
            )}

            {/* Controls */}
            <div className="music-controls">
                {!isPlaying ? (
                    <button className="music-btn play-btn" onClick={() => setShowPlaylist(!showPlaylist)}>
                        🎵 Choose Music
                    </button>
                ) : (
                    <>
                        <button className="music-btn" onClick={isPlaying ? handlePause : handleResume}>
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>
                        <button className="music-btn" onClick={handleStop}>
                            ⏹️
                        </button>
                        <div className="volume-slider">
                            <span>🔊</span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="volume-input"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Playlist Modal */}
            {showPlaylist && (
                <>
                    <div className="playlist-overlay" onClick={() => setShowPlaylist(false)} />
                    <div className="playlist-modal">
                        <h3>🎵 Choose Background Music</h3>
                        {categories.map(cat => (
                            <div key={cat} className="playlist-category">
                                <div className="category-title">{cat}</div>
                                {PLAYLIST.filter(t => t.category === cat).map(track => (
                                    <div
                                        key={track.id}
                                        className={`playlist-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                                        onClick={() => handlePlayTrack(track)}
                                    >
                                        <span className="track-emoji">{track.emoji}</span>
                                        <span className="track-label">{track.name}</span>
                                        {selectedTrack?.id === track.id && isPlaying && (
                                            <span className="playing-indicator">▶️</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                        <button className="close-playlist" onClick={() => setShowPlaylist(false)}>
                            ✕ Close
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default MusicPlayer;