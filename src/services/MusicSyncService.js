export class MusicSyncService {
    constructor() {
        this.localAudio = null;
        this.remoteAudio = null;
        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 0.3;
        this.startTime = 0;

        this.onTrackChange = null;
        this.onPlayStateChange = null;
    }

    async playTrack(trackUrl, trackName, startAt = 0) {
        // Stop current track
        this.stop();

        // Create audio elements
        this.localAudio = new Audio(trackUrl);
        this.localAudio.loop = true;
        this.localAudio.volume = this.volume;
        this.localAudio.currentTime = startAt;

        try {
            await this.localAudio.play();
            this.isPlaying = true;
            this.currentTrack = trackName;
            this.startTime = Date.now() - (startAt * 1000);

            this.onPlayStateChange?.({ playing: true, track: trackName });
            return Date.now();
        } catch (error) {
            console.error('Failed to play:', error);
            return null;
        }
    }

    pause() {
        if (this.localAudio) {
            this.localAudio.pause();
            this.isPlaying = false;
            this.onPlayStateChange?.({ playing: false, track: this.currentTrack });
        }
    }

    resume() {
        if (this.localAudio && !this.isPlaying) {
            this.localAudio.play();
            this.isPlaying = true;
            this.onPlayStateChange?.({ playing: true, track: this.currentTrack });
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.localAudio) {
            this.localAudio.volume = this.volume;
        }
    }

    getCurrentPosition() {
        if (this.localAudio && this.isPlaying) {
            return this.localAudio.currentTime;
        }
        return 0;
    }

    stop() {
        if (this.localAudio) {
            this.localAudio.pause();
            this.localAudio.src = '';
            this.localAudio = null;
        }
        this.isPlaying = false;
        this.currentTrack = null;
        this.startTime = 0;
    }

    cleanup() {
        this.stop();
    }
}

// Pre-defined romantic playlist
export const PLAYLIST = [
    {
        id: 'perfect',
        name: '🎻 Perfect - Ed Sheeran (Instrumental)',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        emoji: '🎻',
        category: 'Romantic',
    },
    {
        id: 'piano',
        name: '🎹 Romantic Piano',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        emoji: '🎹',
        category: 'Romantic',
    },
    {
        id: 'jazz',
        name: '🎷 Smooth Jazz',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        emoji: '🎷',
        category: 'Relaxing',
    },
    {
        id: 'ambient',
        name: '🌌 Ambient Dreams',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        emoji: '🌌',
        category: 'Ambient',
    },
    {
        id: 'lofi',
        name: '☕ Lo-Fi Chill',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        emoji: '☕',
        category: 'Chill',
    },
];