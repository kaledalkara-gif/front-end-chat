import io from 'socket.io-client';

const SIGNALING_SERVER = process.env.REACT_APP_SIGNALING_SERVER || 'http://localhost:3000';

class WebRTCService {
    constructor() {
        this.socket = null;
        this.pc = null;
        this.localStream = null;
        this.remoteStream = null;
        this.dataChannel = null;
        this.isCallInitiator = false;
        this.connectionTimeout = null;
        this.onLoveNoteReceived = null;

        this.onMessage = null;
        this.onRemoteStream = null;
        this.onLocalStream = null;
        this.onConnectionStateChange = null;
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPeerJoined = null;
        this.onError = null;
        this.onPeerLeft = null;
        this.onIncomingCall = null;
        this.onCallAccepted = null;
        this.onCallRejected = null;
        this.onCallEnded = null;
        this.onTouchReceived = null;
        this.iceQueue = [];
    }

    connect() {
        this.socket = io(SIGNALING_SERVER, {
            path: '/socket.io/',
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
            pingInterval: 10000,
            pingTimeout: 60000,
        });

        this.socket.on('connect', () => {
            console.log('🟢 Connected to server:', this.socket.id);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
            this.onError?.('Cannot connect to server. Please try again.');
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error.message);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed');
            this.onError?.('Lost connection to server. Please refresh.');
        });

        this.socket.on('room-created', ({ roomId }) => {
            console.log('🏠 Room created:', roomId);
            this.onRoomCreated?.(roomId);
        });

        this.socket.on('room-joined', ({ roomId }) => {
            console.log('🚪 Joined room:', roomId);
            this.onRoomJoined?.(roomId);
        });

        this.socket.on('peer-joined', () => {
            console.log('👤 Peer joined room');
            this.onPeerJoined?.();
        });

        this.socket.on('call-request', ({ callType }) => {
            console.log('📞 Incoming call request:', callType);
            this.onIncomingCall?.(callType);
        });

        this.socket.on('call-accepted', () => {
            console.log('✅ Call accepted by peer');
            this.onCallAccepted?.();
        });

        this.socket.on('call-rejected', () => {
            console.log('❌ Call rejected by peer');
            this.onCallRejected?.();
        });

        this.socket.on('call-ended', () => {
            console.log('☎️ Call ended by peer');
            this.cleanup();
            this.onCallEnded?.();
        });

        this.socket.on('signal', async ({ type, payload }) => {
            console.log('📡 Signal received:', type);
            await this.handleSignal(type, payload);
        });

        this.socket.on('text-message', ({ text }) => {
            console.log('📩 Text message received');
            this.onMessage?.(text);
        });

        this.socket.on('touch-data', (data) => {
            this.onTouchReceived?.(data);
        });

        this.socket.on('peer-left', () => {
            console.log('👋 Peer left room');
            this.cleanup();
            this.onPeerLeft?.();
        });

        this.socket.on('error', ({ message }) => {
            console.error('❌ Server error:', message);
            this.onError?.(message);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected:', reason);
        });

        this.socket.on('love-note', (data) => {
            this.onLoveNoteReceived?.(data);
        });
    }

    sendTextMessage(text) {
        if (text && text.trim()) {
            this.socket.emit('text-message', { text: text.trim() });
        }
    }

    sendTouchData(touchData) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'touch', ...touchData }));
        } else {
            this.socket.emit('touch-data', touchData);
        }
    }

    sendLoveNote(noteData) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'love-note', ...noteData }));
        } else {
            this.socket.emit('love-note', noteData);
        }
    }

    async startCall(callType) {
        console.log('📞 Starting call:', callType);
        this.isCallInitiator = true;
        try {
            await this.getLocalStream(callType);
            this.createPeerConnection();
            this.addLocalTracks();
            this.socket.emit('call-request', { callType });
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            this.stopLocalStream();
            this.onError?.(error.message || 'Failed to start call');
            throw error;
        }
    }

    async acceptIncomingCall(callType) {
        console.log('✅ Accepting call:', callType);
        this.isCallInitiator = false;
        try {
            await this.getLocalStream(callType);
            this.socket.emit('call-accepted');
        } catch (error) {
            console.error('❌ Failed to accept call:', error);
            this.socket.emit('call-rejected');
            this.onError?.(error.message || 'Failed to accept call');
            throw error;
        }
    }

    onAcceptedByPeer() {
        if (!this.pc || this.pc.connectionState === 'closed') {
            this.createPeerConnection();
            this.addLocalTracks();
        }
        this.createOffer();
    }

    rejectCall() {
        this.socket.emit('call-rejected');
        this.stopLocalStream();
    }

    endCall() {
        this.socket.emit('call-ended');
        this.cleanup();
    }

    async getLocalStream(type) {
        try {
            this.stopLocalStream();
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: type === 'video' ? {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    facingMode: 'user',
                    frameRate: { ideal: 24, max: 30 },
                } : false,
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Local stream ready. Tracks:', this.localStream.getTracks().length);
            this.onLocalStream?.(this.localStream);
            return this.localStream;
        } catch (error) {
            console.error('❌ Media error:', error);
            let message = 'Failed to access media.';
            if (error.name === 'NotAllowedError') message = 'Camera/microphone access denied. Please allow permissions.';
            else if (error.name === 'NotFoundError') message = 'No camera or microphone found.';
            else if (error.name === 'NotReadableError') message = 'Camera/microphone already in use.';
            this.onError?.(message);
            throw new Error(message);
        }
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
            this.onLocalStream?.(null);
        }
    }

    createPeerConnection() {
        if (this.pc) { this.pc.close(); this.pc = null; }
        this.iceQueue = [];
        if (this.connectionTimeout) { clearTimeout(this.connectionTimeout); this.connectionTimeout = null; }

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Metered.ca (your 500MB)
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: "88246c0862ddd651b661cb0e",
                    credential: "/IznfR0gJpp49ZLR",
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: "88246c0862ddd651b661cb0e",
                    credential: "/IznfR0gJpp49ZLR",
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: "88246c0862ddd651b661cb0e",
                    credential: "/IznfR0gJpp49ZLR",
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: "88246c0862ddd651b661cb0e",
                    credential: "/IznfR0gJpp49ZLR",
                },
                // Free backup TURN
                {
                    urls: [
                        'turn:openrelay.metered.ca:80?transport=tcp',
                        'turn:openrelay.metered.ca:443?transport=tcp',
                    ],
                    username: 'openrelayproject',
                    credential: 'openrelayproject',
                },
                // ExpressTURN (free)
                {
                    urls: [
                        'turn:relay1.expressturn.com:3478?transport=tcp',
                    ],
                    username: 'efree',
                    credential: 'efree',
                },
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 8,
        };


        this.pc = new RTCPeerConnection(configuration);

        this.pc.onicegatheringstatechange = () => console.log('📊 ICE gathering:', this.pc?.iceGatheringState);

        if (this.isCallInitiator) {
            this.dataChannel = this.pc.createDataChannel('chat', { ordered: true, id: 0 });
            this.setupDataChannelListeners();
        } else {
            this.pc.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannelListeners();
            };
        }

        this.pc.onconnectionstatechange = () => {
            const state = this.pc?.connectionState;
            console.log('🔄 PC state:', state);
            this.onConnectionStateChange?.(state);
            if (state === 'failed') {
                this.onError?.('Connection failed. Please try again.');
            }
        };

        this.pc.oniceconnectionstatechange = () => {
            const iceState = this.pc?.iceConnectionState;
            console.log('🧊 ICE:', iceState);
            if (this.connectionTimeout) { clearTimeout(this.connectionTimeout); this.connectionTimeout = null; }
            switch (iceState) {
                case 'connected': break;
                case 'disconnected':
                    try { this.pc?.restartIce(); } catch (e) { }
                    break;
                case 'failed':
                    this.onCallEnded?.();
                    break;
                case 'checking':
                    this.connectionTimeout = setTimeout(() => {
                        if (this.pc?.iceConnectionState === 'checking') {
                            try { this.pc?.restartIce(); } catch (e) { }
                        }
                    }, 15000);
                    break;
            }
        };

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('signal', { type: 'ice-candidate', payload: event.candidate });
            }
        };

        this.pc.ontrack = (event) => {
            if (this.remoteStream) {
                try { this.remoteStream.addTrack(event.track); } catch (e) {
                    this.remoteStream = new MediaStream();
                    this.remoteStream.addTrack(event.track);
                }
            } else if (event.streams?.[0]) {
                this.remoteStream = event.streams[0];
            } else {
                this.remoteStream = new MediaStream();
                this.remoteStream.addTrack(event.track);
            }
            if (this.remoteStream) this.onRemoteStream?.(this.remoteStream);
        };
    }

    setupDataChannelListeners() {
        if (!this.dataChannel) return;
        this.dataChannel.onopen = () => console.log('🚀 Data Channel Open');
        this.dataChannel.onclose = () => console.log('🛑 Data Channel Closed');
        this.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'touch') this.onTouchReceived?.(data);
                if (data.type === 'love-note') this.onLoveNoteReceived?.(data);
            } catch (e) { }
        };
    }

    addLocalTracks() {
        if (!this.pc || !this.localStream) return;
        this.localStream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
                try { this.pc.addTrack(track, this.localStream); } catch (e) { }
            }
        });
    }

    // ✅ FIXED: Error callbacks notify UI when offer/answer fail
    async createOffer() {
        try {
            const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await this.pc.setLocalDescription(offer);
            this.socket.emit('signal', { type: 'offer', payload: offer });
        } catch (error) {
            console.error('❌ Offer failed:', error);
            this.onError?.('Failed to establish connection. Please try restarting the call.');
        }
    }

    // ✅ FIXED: Error callbacks notify UI when offer/answer fail
    async createAnswer() {
        try {
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.socket.emit('signal', { type: 'answer', payload: answer });
        } catch (error) {
            console.error('❌ Answer failed:', error);
            this.onError?.('Failed to establish connection. Please try restarting the call.');
        }
    }

    async processIceQueue() {
        while (this.iceQueue.length > 0) {
            const candidate = this.iceQueue.shift();
            try {
                await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Failed to add buffered ICE candidate:', e);
            }
        }
    }

    async handleSignal(type, payload) {
        try {
            switch (type) {
                case 'offer':
                    if (!this.pc || this.pc.connectionState === 'closed') {
                        this.isCallInitiator = false;
                        this.createPeerConnection();
                        this.addLocalTracks();
                    }
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    await this.processIceQueue();
                    await this.createAnswer();
                    break;
                case 'answer':
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    await this.processIceQueue();
                    break;
                case 'ice-candidate':
                    if (payload?.candidate) {
                        if (this.pc?.remoteDescription) {
                            await this.pc.addIceCandidate(new RTCIceCandidate(payload));
                        } else {
                            this.iceQueue.push(payload); // Buffer until remote description is set
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Signal error:', error);
            this.onError?.('Connection error. Please try again.');
        }
    }

    cleanup() {
        this.iceQueue = [];
        if (this.connectionTimeout) { clearTimeout(this.connectionTimeout); this.connectionTimeout = null; }
        this.stopLocalStream();
        this.remoteStream = null;
        if (this.dataChannel) { this.dataChannel.close(); this.dataChannel = null; }
        if (this.pc) { this.pc.close(); this.pc = null; }
        this.isCallInitiator = false;
    }

    createRoom() { this.socket.emit('create-room'); }
    joinRoom(roomId) { this.socket.emit('join-room', { roomId: roomId.toUpperCase() }); }
    leaveRoom() { this.endCall(); this.socket.emit('leave-room'); this.cleanup(); }
    disconnect() { this.leaveRoom(); if (this.socket) { this.socket.disconnect(); this.socket = null; } }
}

export default WebRTCService;