import io from 'socket.io-client';

const SIGNALING_SERVER = process.env.REACT_APP_SIGNALING_SERVER || 'http://localhost:3000';

class WebRTCService {
    constructor() {
        this.socket = null;
        this.pc = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCallInitiator = false;
        this.connectionTimeout = null;

        // Callbacks
        this.onMessage = null;
        this.onRemoteStream = null;
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
            if (reason === 'io server disconnect') {
                // Server disconnected us, try reconnecting
                this.socket.connect();
            }
        });
    }

    // ============ TEXT MESSAGING ============

    sendTextMessage(text) {
        if (text && text.trim()) {
            this.socket.emit('text-message', { text: text.trim() });
        }
    }

    // ============ CALL FLOW ============

    async startCall(callType) {
        console.log('📞 Starting call as INITIATOR:', callType);
        this.isCallInitiator = true;

        try {
            // Get local media first
            await this.getLocalStream(callType);

            // Create peer connection
            this.createPeerConnection();

            // Add local tracks to peer connection
            this.addLocalTracks();

            // Send call request to peer
            this.socket.emit('call-request', { callType });

            console.log('✅ Call request sent, waiting for peer to accept...');
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            this.stopLocalStream();
            throw error;
        }
    }

    async acceptIncomingCall(callType) {
        console.log('✅ Accepting call as RECEIVER:', callType);
        this.isCallInitiator = false;

        try {
            // Get local media
            await this.getLocalStream(callType);

            // Tell initiator we accept
            this.socket.emit('call-accepted');

            console.log('✅ Acceptance sent, waiting for offer...');
        } catch (error) {
            console.error('❌ Failed to accept call:', error);
            this.socket.emit('call-rejected');
            throw error;
        }
    }

    onAcceptedByPeer() {
        console.log('📤 Peer accepted, creating offer...');
        // If we don't have a peer connection yet, create one
        if (!this.pc || this.pc.connectionState === 'closed') {
            this.createPeerConnection();
            this.addLocalTracks();
        }
        this.createOffer();
    }

    rejectCall() {
        console.log('❌ Rejecting call');
        this.socket.emit('call-rejected');
        this.stopLocalStream();
    }

    endCall() {
        console.log('☎️ Ending call');
        this.socket.emit('call-ended');
        this.cleanup();
    }

    // ============ MEDIA ============

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

            console.log('🎥 Requesting media with constraints:', constraints);
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Local stream ready. Tracks:', this.localStream.getTracks().length);

            // Log each track
            this.localStream.getTracks().forEach((track) => {
                console.log(`  Track: ${track.kind} - ${track.label} (${track.readyState})`);
            });

            return this.localStream;
        } catch (error) {
            console.error('❌ Media error:', error.name, error.message);

            if (error.name === 'NotAllowedError') {
                throw new Error('Camera/microphone access denied. Please allow permissions in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera or microphone found. Please connect a device.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Camera/microphone is already in use by another application.');
            } else {
                throw new Error('Failed to access media: ' + error.message);
            }
        }
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
            console.log('🛑 Local stream stopped');
        }
    }

    // ============ WEBRTC ============

    createPeerConnection() {
        // Close existing connection if any
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        // Clear any existing timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        const configuration = {
            iceServers: [
                // Google STUN servers
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // Free TURN servers (critical for mobile)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject',
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject',
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject',
                },
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 4,
        };

        console.log('🔨 Creating peer connection...');
        this.pc = new RTCPeerConnection(configuration);

        // Connection state changes
        this.pc.onconnectionstatechange = () => {
            const state = this.pc?.connectionState;
            console.log('🔄 Peer connection state:', state);
            this.onConnectionStateChange?.(state);

            if (state === 'connected') {
                console.log('✅ P2P connection established!');
            } else if (state === 'failed') {
                console.error('❌ P2P connection failed');
                this.onError?.('Connection failed. Please try again.');
            }
        };

        // ICE connection state changes
        this.pc.oniceconnectionstatechange = () => {
            const iceState = this.pc?.iceConnectionState;
            console.log('🧊 ICE state:', iceState);

            // Clear any existing timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }

            switch (iceState) {
                case 'connected':
                    console.log('✅ ICE connected');
                    break;

                case 'disconnected':
                    console.log('🔄 ICE disconnected, attempting restart...');
                    try {
                        this.pc?.restartIce();
                    } catch (e) {
                        console.error('ICE restart failed:', e);
                    }
                    break;

                case 'failed':
                    console.error('❌ ICE failed completely');
                    this.onCallEnded?.();
                    break;

                case 'checking':
                    console.log('🔍 ICE checking...');
                    // Set timeout - if still checking after 15 seconds, restart
                    this.connectionTimeout = setTimeout(() => {
                        if (this.pc?.iceConnectionState === 'checking') {
                            console.log('⏰ ICE checking timeout - restarting');
                            try {
                                this.pc?.restartIce();
                            } catch (e) {
                                console.error('ICE restart failed:', e);
                            }
                        }
                    }, 15000);
                    break;
            }
        };

        // ICE candidate events
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🍦 Sending ICE candidate:', event.candidate.type);
                this.socket.emit('signal', {
                    type: 'ice-candidate',
                    payload: event.candidate,
                });
            } else {
                console.log('🍦 All ICE candidates sent');
            }
        };

        // ICE gathering state
        this.pc.onicegatheringstatechange = () => {
            console.log('📊 ICE gathering state:', this.pc?.iceGatheringState);
        };

        // Signaling state
        this.pc.onsignalingstatechange = () => {
            console.log('📶 Signaling state:', this.pc?.signalingState);
        };

        // Remote track received
        this.pc.ontrack = (event) => {
            console.log('📹 Remote track received:', event.track.kind, event.track.label);

            if (this.remoteStream) {
                // Add track to existing remote stream
                try {
                    this.remoteStream.addTrack(event.track);
                    console.log('➕ Track added to existing remote stream');
                } catch (e) {
                    console.log('Could not add track, recreating stream');
                    this.remoteStream = new MediaStream();
                    this.remoteStream.addTrack(event.track);
                }
            } else if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                console.log('📥 New remote stream received');
            }

            // Notify UI about the remote stream
            if (this.remoteStream) {
                this.onRemoteStream?.(this.remoteStream);
            }
        };

        console.log('✅ Peer connection created');
    }

    addLocalTracks() {
        if (!this.pc || !this.localStream) {
            console.warn('⚠️ Cannot add tracks - no PC or local stream');
            return;
        }

        console.log('➕ Adding local tracks to peer connection...');
        this.localStream.getTracks().forEach((track) => {
            if (track.readyState === 'live') {
                try {
                    this.pc.addTrack(track, this.localStream);
                    console.log(`  ✅ Added ${track.kind}: ${track.label}`);
                } catch (e) {
                    console.error(`  ❌ Failed to add ${track.kind}:`, e);
                }
            }
        });
    }

    async createOffer() {
        try {
            console.log('📤 Creating offer...');
            const offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            await this.pc.setLocalDescription(offer);
            console.log('✅ Local description set (offer)');
            this.socket.emit('signal', { type: 'offer', payload: offer });
        } catch (error) {
            console.error('❌ Failed to create offer:', error);
            this.onError?.('Failed to establish connection. Please try again.');
        }
    }

    async createAnswer() {
        try {
            console.log('📤 Creating answer...');
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            console.log('✅ Local description set (answer)');
            this.socket.emit('signal', { type: 'answer', payload: answer });
        } catch (error) {
            console.error('❌ Failed to create answer:', error);
            this.onError?.('Failed to establish connection. Please try again.');
        }
    }

    async handleSignal(type, payload) {
        try {
            console.log('📡 Handling signal:', type);

            switch (type) {
                case 'offer':
                    console.log('📥 Received offer');
                    // Create peer connection if needed
                    if (!this.pc || this.pc.connectionState === 'closed') {
                        this.isCallInitiator = false;
                        this.createPeerConnection();
                        this.addLocalTracks();
                    }
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    console.log('✅ Remote description set (offer)');
                    await this.createAnswer();
                    break;

                case 'answer':
                    console.log('📥 Received answer');
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    console.log('✅ Remote description set (answer)');
                    break;

                case 'ice-candidate':
                    if (payload && payload.candidate) {
                        console.log('📥 Received ICE candidate:', payload.type || 'unknown');
                        try {
                            await this.pc?.addIceCandidate(new RTCIceCandidate(payload));
                            console.log('✅ ICE candidate added');
                        } catch (e) {
                            console.error('❌ Failed to add ICE candidate:', e);
                        }
                    }
                    break;

                default:
                    console.warn('⚠️ Unknown signal type:', type);
            }
        } catch (error) {
            console.error('❌ Signal handling error:', error);
        }
    }

    // ============ CLEANUP ============

    cleanup() {
        console.log('🧹 Cleaning up...');

        // Clear timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // Stop media streams
        this.stopLocalStream();

        // Clear remote stream
        this.remoteStream = null;

        // Close peer connection
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        this.isCallInitiator = false;
        console.log('✅ Cleanup complete');
    }

    // ============ ROOM MANAGEMENT ============

    createRoom() {
        console.log('🏠 Creating room');
        this.socket.emit('create-room');
    }

    joinRoom(roomId) {
        console.log('🚪 Joining room:', roomId);
        this.socket.emit('join-room', { roomId: roomId.toUpperCase() });
    }

    leaveRoom() {
        console.log('👋 Leaving room');
        this.endCall();
        this.socket.emit('leave-room');
        this.cleanup();
    }

    disconnect() {
        console.log('🔌 Disconnecting');
        this.leaveRoom();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

export default WebRTCService;