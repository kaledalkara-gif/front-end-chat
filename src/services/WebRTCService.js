import io from 'socket.io-client';

const SIGNALING_SERVER = process.env.REACT_APP_SIGNALING_SERVER || 'http://localhost:3000';

class WebRTCService {
    constructor() {
        this.socket = null;
        this.pc = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCallInitiator = false;

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
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 60000,
            pingInterval: 10000,
            pingTimeout: 60000,
        });

        this.socket.on('connect', () => console.log('🟢 Connected:', this.socket.id));
        this.socket.on('room-created', ({ roomId }) => this.onRoomCreated?.(roomId));
        this.socket.on('room-joined', ({ roomId }) => this.onRoomJoined?.(roomId));
        this.socket.on('peer-joined', () => this.onPeerJoined?.());
        this.socket.on('call-request', ({ callType }) => this.onIncomingCall?.(callType));
        this.socket.on('call-accepted', () => this.onCallAccepted?.());
        this.socket.on('call-rejected', () => this.onCallRejected?.());
        this.socket.on('call-ended', () => { this.cleanup(); this.onCallEnded?.(); });
        this.socket.on('signal', ({ type, payload }) => this.handleSignal(type, payload));
        this.socket.on('text-message', ({ text }) => this.onMessage?.(text));
        this.socket.on('peer-left', () => { this.cleanup(); this.onPeerLeft?.(); });
        this.socket.on('error', ({ message }) => this.onError?.(message));
    }

    sendTextMessage(text) {
        this.socket.emit('text-message', { text });
    }

    // ============ CALL FLOW ============

    async startCall(callType) {
        console.log('📞 Starting call as INITIATOR:', callType);
        this.isCallInitiator = true;

        // 1. Get local media
        await this.getLocalStream(callType);

        // 2. Create peer connection
        this.createPeerConnection();

        // 3. Add local tracks
        this.addLocalTracks();

        // 4. Send call request
        this.socket.emit('call-request', { callType });
    }

    async acceptIncomingCall(callType) {
        console.log('✅ Accepting call as RECEIVER:', callType);
        this.isCallInitiator = false;

        // 1. Get local media
        await this.getLocalStream(callType);

        // 2. Tell initiator we accept
        this.socket.emit('call-accepted');

        // 3. Initator will create offer, we'll get it via signal
    }

    // Called by initiator when call-accepted is received
    onAcceptedByPeer() {
        console.log('📤 Peer accepted, creating offer...');
        this.createOffer();
    }

    rejectCall() {
        this.socket.emit('call-rejected');
    }

    endCall() {
        console.log('☎️ Ending call');
        this.socket.emit('call-ended');
        this.cleanup();
    }

    // ============ WEBRTC ============

    async getLocalStream(type) {
        this.stopLocalStream();

        const constraints = {
            audio: true,
            video: type === 'video' ? { width: 640, height: 480 } : false,
        };

        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Local stream:', this.localStream.getTracks().length, 'tracks');
        return this.localStream;
    }

    createPeerConnection() {
        if (this.pc) {
            this.pc.close();
        }

        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 2,
        };

        this.pc = new RTCPeerConnection(configuration);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('signal', { type: 'ice-candidate', payload: event.candidate });
            }
        };

        this.pc.ontrack = (event) => {
            console.log('📹 Remote track:', event.track.kind);
            if (this.remoteStream) {
                this.remoteStream.addTrack(event.track);
            } else if (event.streams[0]) {
                this.remoteStream = event.streams[0];
            }
            if (this.remoteStream) {
                this.onRemoteStream?.(this.remoteStream);
            }
        };

        this.pc.onconnectionstatechange = () => {
            console.log('🔄 PC state:', this.pc?.connectionState);
            this.onConnectionStateChange?.(this.pc?.connectionState);
        };

        // Add ICE connection state handling
        this.pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE state:', this.pc?.iceConnectionState);

            if (this.pc?.iceConnectionState === 'disconnected') {
                console.log('🔄 ICE disconnected, attempting restart...');
                this.pc?.restartIce();
            }

            if (this.pc?.iceConnectionState === 'failed') {
                console.log('❌ ICE failed');
                this.onCallEnded?.();
            }
        };

        // Add local tracks if available
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                if (track.readyState === 'live') {
                    this.pc.addTrack(track, this.localStream);
                }
            });
        }
    }

    addLocalTracks() {
        if (!this.pc || !this.localStream) return;

        this.localStream.getTracks().forEach(track => {
            console.log('➕ Adding track:', track.kind);
            this.pc.addTrack(track, this.localStream);
        });
    }

    async createOffer() {
        try {
            console.log('📤 Creating offer...');
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            console.log('✅ Offer created, sending...');
            this.socket.emit('signal', { type: 'offer', payload: offer });
        } catch (e) {
            console.error('❌ Offer error:', e);
        }
    }

    async createAnswer() {
        try {
            console.log('📤 Creating answer...');
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            console.log('✅ Answer created, sending...');
            this.socket.emit('signal', { type: 'answer', payload: answer });
        } catch (e) {
            console.error('❌ Answer error:', e);
        }
    }

    async handleSignal(type, payload) {
        try {
            console.log('📡 Handling signal:', type);

            switch (type) {
                case 'offer':
                    console.log('📥 Got offer, creating PC as receiver...');
                    this.createPeerConnection();
                    this.addLocalTracks();
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    await this.createAnswer();
                    break;

                case 'answer':
                    console.log('📥 Got answer...');
                    await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
                    break;

                case 'ice-candidate':
                    if (payload) {
                        await this.pc?.addIceCandidate(new RTCIceCandidate(payload));
                    }
                    break;
            }
        } catch (e) {
            console.error('❌ Signal error:', e);
        }
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
    }

    cleanup() {
        this.stopLocalStream();
        this.remoteStream = null;
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.isCallInitiator = false;
        console.log('🧹 Cleanup done');
    }

    // ============ ROOM ============
    createRoom() { this.socket.emit('create-room'); }
    joinRoom(roomId) { this.socket.emit('join-room', { roomId: roomId.toUpperCase() }); }

    leaveRoom() {
        this.endCall();
        this.socket.emit('leave-room');
        this.cleanup();
    }

    disconnect() {
        this.leaveRoom();
        this.socket?.disconnect();
    }
}

export default WebRTCService;