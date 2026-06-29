export class MusicSyncService {
    constructor() {
        // Single persistent audio instance avoids memory allocation leaks
        this.audio = new Audio();
        this.audio.loop = true;

        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 0.3;
        this.startTime = 0;

        // Playback lock to guard against overlapping play/pause race condition states
        this.playPromise = null;

        // Callbacks for UI Synchronization
        this.onTrackChange = null;
        this.onPlayStateChange = null;

        // Attach native event listeners once
        this.initNativeListeners();
    }

    initNativeListeners() {
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.onPlayStateChange?.({ playing: false, track: this.currentTrack });
        });

        this.audio.addEventListener('error', (e) => {
            console.error('HTML5 Audio Engine Error Instance:', e);
            this.handlePlaybackFailure();
        });
    }

    async playTrack(trackUrl, trackName, startAt = 0) {
        // 1. Safely halt and clear any ongoing track cycles
        await this.stop();

        this.currentTrack = trackName;
        this.audio.src = trackUrl;
        this.audio.volume = this.volume;
        this.audio.currentTime = startAt;

        // Trigger explicit track alteration callback
        this.onTrackChange?.(trackName);

        try {
            // 2. Capture the asynchronous execution promise loop
            this.playPromise = this.audio.play();
            await this.playPromise;

            // 3. Update configuration statuses cleanly upon successful execution
            this.isPlaying = true;
            this.startTime = Date.now() - (startAt * 1000);
            this.onPlayStateChange?.({ playing: true, track: trackName });

            return Date.now();
        } catch (error) {
            // Aborted errors occur naturally when switching tracks rapidly; only log actual runtime errors
            if (error.name !== 'AbortError') {
                console.error('Failed to initialize audio play path:', error);
            }
            this.handlePlaybackFailure();
            return null;
        } finally {
            this.playPromise = null;
        }
    }

    async pause() {
        // If the audio engine is actively resolving a boot promise, wait for it first
        if (this.playPromise) {
            try { await this.playPromise; } catch { /* ignore baseline failure */ }
        }

        if (!this.audio.paused) {
            this.audio.pause();
            this.isPlaying = false;
            this.onPlayStateChange?.({ playing: false, track: this.currentTrack });
        }
    }

    async resume() {
        if (this.audio.src && this.audio.paused && !this.isPlaying) {
            try {
                this.playPromise = this.audio.play();
                await this.playPromise;
                this.isPlaying = true;
                this.onPlayStateChange?.({ playing: true, track: this.currentTrack });
            } catch (error) {
                console.error('Failed to resume track playback execution:', error);
                this.playPromise = null;
            }
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        this.audio.volume = this.volume;
    }

    getCurrentPosition() {
        return this.audio ? this.audio.currentTime : 0;
    }

    async stop() {
        // Prevent interrupting ongoing play mutations by safely resolving the internal promise lock first
        if (this.playPromise) {
            try { await this.playPromise; } catch { /* ignore baseline failure */ }
            this.playPromise = null;
        }

        this.audio.pause();
        // Clearing the src attribute breaks the network download pipeline safely and frees memory pipelines
        this.audio.removeAttribute('src');
        this.audio.load();

        this.isPlaying = false;
        this.currentTrack = null;
        this.startTime = 0;
    }

    handlePlaybackFailure() {
        this.isPlaying = false;
        this.currentTrack = null;
        this.startTime = 0;
        this.onPlayStateChange?.({ playing: false, track: null });
    }

    cleanup() {
        this.stop();
        // Complete event garbage removal collection
        this.audio.replaceWith(this.audio.cloneNode(true));
    }
}

// Pre-defined playlist
export const PLAYLIST = [
    {
        id: 'perfect',
        name: 'Romantic Piano',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        emoji: '🎹',
        category: 'Romantic',
    },
    {
        id: 'piano',
        name: 'Soft Melody',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        emoji: '🎻',
        category: 'Romantic',
    },
    {
        id: 'jazz',
        name: 'Smooth Jazz',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        emoji: '🎷',
        category: 'Relaxing',
    },
    {
        id: 'ambient',
        name: 'Ambient Dreams',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        emoji: '🌌',
        category: 'Ambient',
    },
    {
        id: 'lofi',
        name: 'Lo-Fi Chill',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        emoji: '☕',
        category: 'Chill',
    },
];