import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import WebRTCService from '../services/WebRTCService';
import { HapticService, TOUCH_PATTERNS } from '../services/HapticService';
import { KissSyncService, KISS_MATCH_VIBRATION } from '../services/KissSyncService';
import TouchOverlay from './TouchOverlay';
import KissMatch from './KissMatch';
import MusicPlayer from './MusicPlayer';
import { MusicSyncService } from '../services/MusicSyncService';
import LoveNotes from './LoveNotes';
import DrawCanvas from './DrawCanvas';
import { DrawSyncService } from '../services/DrawSyncService';
import './ChatRoom.css';


const EMOJIS = {
    faces: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪', '😝', '🤗', '🤔', '😐', '😶', '😏', '😒', '🙄', '😬', '😮', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😈', '👿', '💀', '🤡', '👻', '💪', '👍', '👎', '👏', '🙌', '🤝', '🙏'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
    gestures: ['👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋', '🖖', '👌'],
    party: ['🎉', '🎊', '🎈', '🎂', '🎀', '🎁', '🎄', '✨', '🎵', '🎶', '🎤', '🎧', '🎼', '🎹', '🎸', '🎺', '🎯', '🎮', '⚽', '🏀', '🏆', '🥇'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐝', '🦋', '🐞', '🐢', '🐍', '🦖', '🐙', '🐠', '🐟', '🐬', '🐳', '🦈'],
    food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑', '🍒', '🥭', '🍍', '🥝', '🍅', '🥑', '🥦', '🌽', '🥕', '🧄', '🧅', '🥔', '🍞', '🧀', '🥚', '🥓', '🥩', '🍗', '🍔', '🍟', '🍕', '🌮', '🌯', '🥗', '🍝', '🍜', '🍣', '🍱', '🍤', '🍙', '🍚', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚓', '🚑', '🚒', '🏍️', '🚲', '🛴', '🚄', '🚅', '✈️', '🚁', '🚀', '🛸', '⛵', '🚤', '🛳️', '🏠', '🏡', '🏢', '🏰', '🏯', '🗽', '🗼', '🌍', '🌋', '🏔️', '🏖️', '🏝️', '🌅', '🌈', '☀️', '🌤️', '☁️', '🌧️', '⛈️', '❄️', '☃️', '🌊', '🔥', '💧', '🌟', '⭐', '🌙', '🪐'],
    objects: ['📱', '💻', '⌚', '📷', '🎥', '💡', '🔦', '📚', '💰', '💳', '💎', '🔑', '🔨', '🪓', '🔧', '⚙️', '🔗', '🔬', '🔭', '📡', '💉', '💊', '🧹', '🧺', '🚽', '🚿', '🛁', '🧼'],
    symbols: ['❤️', '💛', '💚', '💙', '💜', '🖤', '✅', '❌', '⚠️', '🚫', '➕', '➖', '❓', '❗', '〰️', '💲', '♻️', '🔱', '⭕', '☑️', '✔️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪']
};

const PIP_SIZE = { desktop: { w: 180, h: 240 }, mobile: { w: 100, h: 140 } };

const EmojiPicker = memo(({ onSelect }) => (
    <div className="emoji-picker-container">
        <div className="emoji-categories">
            {Object.keys(EMOJIS).map(cat => (
                <button key={cat} onClick={() => document.getElementById(`emoji-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth' })} className="emoji-cat-btn">{cat}</button>
            ))}
        </div>
        {Object.entries(EMOJIS).map(([cat, ems]) => (
            <div key={cat} id={`emoji-cat-${cat}`}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', margin: '8px 0 4px' }}>{cat}</div>
                <div className="emoji-grid">
                    {ems.map((e, i) => <button key={i} onClick={() => onSelect(e)} className="emoji-item">{e}</button>)}
                </div>
            </div>
        ))}
    </div>
));

const ChatRoom = () => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [roomId, setRoomId] = useState('');
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [roomCreated, setRoomCreated] = useState(false);
    const [callState, setCallState] = useState('idle');
    const [incomingCallType, setIncomingCallType] = useState(null);
    const [callType, setCallType] = useState('video');
    const [callHeight, setCallHeight] = useState(40);
    const [showEmojis, setShowEmojis] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [receivedTouches, setReceivedTouches] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mainIsLocal, setMainIsLocal] = useState(true);
    const [pipPos, setPipPos] = useState({ x: 10, y: 10 });
    const [kissMatches, setKissMatches] = useState([]);
    const [kissCloseness, setKissCloseness] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);
    const [sentLoveNotes, setSentLoveNotes] = useState([]);
    const [receivedLoveNotes, setReceivedLoveNotes] = useState([]);
    const [showDrawCanvas, setShowDrawCanvas] = useState(false);
    const [receivedDrawStrokes, setReceivedDrawStrokes] = useState([]);

    const webrtcService = useRef(null);
    const mainVideoRef = useRef(null);
    const pipVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const messagesEndRef = useRef(null);
    const pipRef = useRef(null);
    const callAreaRef = useRef(null);
    const kissSyncRef = useRef(new KissSyncService());
    const dragStart = useRef({ startX: 0, startY: 0, startPipX: 0, startPipY: 0 });
    const resizeStart = useRef({ startY: 0, startHeight: 0 });
    const musicSyncRef = useRef(new MusicSyncService());
    const drawSyncRef = useRef(new DrawSyncService());

    const pipIsLocal = !mainIsLocal;
    const showMainOff = mainIsLocal ? isCameraOff : false;
    const showPipOff = pipIsLocal ? isCameraOff : false;
    const pipSize = isMobile ? PIP_SIZE.mobile : PIP_SIZE.desktop;


    const handleSendStroke = (stroke) => {
        if (stroke) {
            webrtcService.current?.sendDrawStroke?.(stroke);
        } else {
            setShowDrawCanvas(prev => !prev);
        }
    };

    const handleClearCanvas = () => {
        console.log('🧹 Sending clear canvas');
        webrtcService.current?.sendClearCanvas?.();
    };
    const handleCompleteKiss = useCallback((matchId) => {
        setKissMatches(prev => prev.filter(k => k.id !== matchId));
    }, []);

    const handleSendLoveNote = (noteData) => {
        // Show locally
        setSentLoveNotes(prev => [...prev.slice(-5), { ...noteData, id: Date.now() }]);

        // Send to partner via WebRTC data channel or socket
        webrtcService.current?.sendLoveNote?.(noteData);
    };

    const clearMedia = useCallback(() => {
        setIsMuted(false);
        setIsCameraOff(false);
        setLocalStream(null);
        setRemoteStream(null);
        if (mainVideoRef.current) mainVideoRef.current.srcObject = null;
        if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const service = new WebRTCService();
        webrtcService.current = service;

        service.onMessage = (text) => setMessages(prev => [...prev, { text, fromMe: false, id: Date.now() }]);
        service.onRemoteStream = (stream) => setRemoteStream(stream);
        service.onLocalStream = (stream) => setLocalStream(stream);
        service.onConnectionStateChange = (state) => setConnectionStatus(state);
        service.onRoomCreated = (id) => { setRoomId(id); setRoomCreated(true); };
        service.onRoomJoined = (id) => { setRoomId(id); setIsConnected(true); setRoomCreated(true); };
        service.onPeerJoined = () => setIsConnected(true);
        service.onIncomingCall = (type) => { setIncomingCallType(type); setCallState('ringing'); };
        service.onCallAccepted = () => { webrtcService.current?.onAcceptedByPeer(); setCallState('in-call'); };
        service.onCallRejected = () => { setCallState('idle'); setIncomingCallType(null); clearMedia(); };
        service.onCallEnded = () => { setCallState('idle'); clearMedia(); };
        service.onPeerLeft = () => { setIsConnected(false); setCallState('idle'); clearMedia(); };
        service.onDrawStrokeReceived = (stroke) => {
            setReceivedDrawStrokes(prev => [...prev.slice(-10), stroke]);
        };

        service.onClearCanvasReceived = () => {
            console.log('🧹 Clear received in ChatRoom');  // Add this
            setReceivedDrawStrokes([]);
            drawSyncRef.current?.clearCanvas();
        };

        service.onTouchReceived = (touchData) => {
            const touchWithId = { ...touchData, id: Date.now() + Math.random() };
            setReceivedTouches(prev => [...prev.slice(-5), touchWithId]);
            HapticService.vibrate(touchData.pattern);
            if (touchData.pattern === 'kiss') {
                kissSyncRef.current.registerPartnerTouch(touchWithId.id, touchData.x, touchData.y, touchData.pattern);
                setTimeout(() => kissSyncRef.current.removePartnerTouch(touchWithId.id), 2000);
            }
            setTimeout(() => setReceivedTouches(prev => prev.filter(t => t.id !== touchWithId.id)), TOUCH_PATTERNS[touchData.pattern]?.duration || 1500);
        };

        service.onLoveNoteReceived = (noteData) => {
            setReceivedLoveNotes(prev => [...prev.slice(-5), { ...noteData, id: Date.now() }]);
        };

        service.onError = (msg) => console.error(msg);
        service.connect();

        const kissSync = kissSyncRef.current;
        kissSync.onKissMatch = (match) => {
            const m = { ...match, id: Date.now() };
            setKissMatches(prev => [...prev.slice(-3), m]);
            if (navigator.vibrate) navigator.vibrate(KISS_MATCH_VIBRATION);
            setTimeout(() => setKissMatches(prev => prev.filter(k => k.id !== m.id)), 3000);
        };
        kissSync.onKissProgress = (c) => setKissCloseness(c);

        return () => { service.disconnect(); kissSync.reset(); };
    }, [clearMedia]);

    //  tracking connector step to run inside ChatRoom layout effect loops:
    useEffect(() => {
        const rect = callAreaRef.current?.getBoundingClientRect();
        if (rect) {
            kissSyncRef.current.setAspectRatio(rect.width, rect.height);
        }
    }, [callHeight, isConnected]);
    // Updates normalization math on screen adjustments instantly!

    useEffect(() => {
        // Catch iOS sensory events and fire custom CSS ripple alerts automatically
        HapticService.onFallbackAlert = (patternKey) => {
            const color = TOUCH_PATTERNS[patternKey]?.color || '#ff4081';
            console.log(`Flash UI screen wrapper border color with ${color} as iOS visual haptic confirmation!`);
            // Run temporary state flashes here to preserve tactile communication metrics flawlessly...
        };

        return () => {
            HapticService.onFallbackAlert = null;
        };
    }, []);



    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ✅ BULLETPROOF: Independent stream assignment - local preview works immediately
    useEffect(() => {
        // Remote audio
        if (remoteStream && remoteAudioRef.current) {
            const audioOnlyStream = new MediaStream();
            remoteStream.getAudioTracks().forEach(track => audioOnlyStream.addTrack(track));
            remoteAudioRef.current.srcObject = audioOnlyStream;
            remoteAudioRef.current.play().catch(() => { });
        }

        // Video panels - works even when remote is null (local preview)
        if (callType === 'video') {
            if (mainVideoRef.current) {
                mainVideoRef.current.srcObject = mainIsLocal ? localStream : remoteStream;
                mainVideoRef.current.muted = mainIsLocal;
            }
            if (pipVideoRef.current) {
                pipVideoRef.current.srcObject = pipIsLocal ? localStream : remoteStream;
                pipVideoRef.current.muted = pipIsLocal;
            }
        } else {
            if (mainVideoRef.current) mainVideoRef.current.srcObject = null;
            if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
        }
    }, [mainIsLocal, callType, localStream, remoteStream]);

    // ✅ BULLETPROOF: PiP corner snapping
    const snapToCorner = useCallback((x, y, pw, ph) => {
        const parent = callAreaRef.current;
        if (!parent) return { x, y };
        const pw2 = parent.offsetWidth / 2;
        const ph2 = parent.offsetHeight / 2;
        return {
            x: x < pw2 ? 8 : parent.offsetWidth - pw - 8,
            y: y < ph2 ? 8 : parent.offsetHeight - ph - 8,
        };
    }, []);

    // ✅ BULLETPROOF: PiP drag start - stores absolute coordinates
    const onPiPStart = useCallback((e) => {
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart.current = {
            startX: clientX,
            startY: clientY,
            startPipX: pipPos.x,
            startPipY: pipPos.y,
        };
        setIsDragging(true);
    }, [pipPos]);

    // ✅ BULLETPROOF: PiP drag effect - clean listener management
    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e) => {
            const parent = callAreaRef.current;
            if (!parent) return;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaX = cx - dragStart.current.startX;
            const deltaY = cy - dragStart.current.startY;
            setPipPos({
                x: Math.max(0, Math.min(parent.offsetWidth - pipSize.w, dragStart.current.startPipX + deltaX)),
                y: Math.max(0, Math.min(parent.offsetHeight - pipSize.h, dragStart.current.startPipY + deltaY)),
            });
        };

        const onEnd = () => {
            setIsDragging(false);
            setPipPos(prev => snapToCorner(prev.x, prev.y, pipSize.w, pipSize.h));
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };
    }, [isDragging, pipSize, snapToCorner]);

    // ✅ BULLETPROOF: Vertical resize - same pattern as PiP drag
    const onResizeStart = useCallback((e) => {
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        resizeStart.current = {
            startY: clientY,
            startHeight: callHeight,
        };
        setIsResizing(true);
    }, [callHeight]);

    useEffect(() => {
        if (!isResizing) return;

        const onMove = (me) => {
            const currentY = me.touches ? me.touches[0].clientY : me.clientY;
            setCallHeight(Math.max(25, Math.min(70,
                resizeStart.current.startHeight + (resizeStart.current.startY - currentY) / window.innerHeight * 100
            )));
        };

        const onEnd = () => setIsResizing(false);

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };
    }, [isResizing]);

    const swapVideos = () => setMainIsLocal(prev => !prev);

    const handleStartCall = async (type) => {
        setCallType(type);
        setCallState('requesting');
        try {
            await webrtcService.current?.startCall(type);
            setLocalStream(webrtcService.current?.localStream || null);
        } catch (err) {
            setCallState('idle');
        }
    };

    const handleAcceptCall = async () => {
        const type = incomingCallType || 'video';
        setCallType(type);
        try {
            await webrtcService.current?.acceptIncomingCall(type);
            setCallState('in-call');
            setIncomingCallType(null);
            setLocalStream(webrtcService.current?.localStream || null);
        } catch (err) {
            setCallState('idle');
            setIncomingCallType(null);
        }
    };

    const handleRejectCall = () => { webrtcService.current?.rejectCall(); setCallState('idle'); setIncomingCallType(null); };
    const handleEndCall = () => { webrtcService.current?.endCall(); setCallState('idle'); clearMedia(); setKissMatches([]); setKissCloseness(0); musicSyncRef.current?.cleanup(); };

    const toggleMute = () => {
        const t = localStream?.getAudioTracks()[0];
        if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); }
    };

    const toggleCamera = () => {
        const t = localStream?.getVideoTracks()[0];
        if (t) { t.enabled = !t.enabled; setIsCameraOff(!t.enabled); }
    };

    const handleSendMessage = () => {
        if (inputText.trim() && isConnected) {
            webrtcService.current?.sendTextMessage(inputText);
            setMessages(prev => [...prev, { text: inputText, fromMe: true, id: Date.now() }]);
            setInputText('');
        }
    };

    const handleLeaveRoom = () => {
        handleEndCall();
        webrtcService.current?.leaveRoom();
        setIsConnected(false);
        setRoomCreated(false);
        setRoomId('');
        setMessages([]);
        kissSyncRef.current.reset();
        musicSyncRef.current?.cleanup();
    };

    const isInCall = callState === 'in-call' || callState === 'requesting';
    const sc = isInCall ? 'in-call' : isConnected ? 'connected' : roomCreated ? 'waiting' : 'ready';
    const st = isInCall ? '📹 In Call' : isConnected ? 'Connected' : roomCreated ? 'Waiting for partner' : 'Ready';
    const isReconnecting = connectionStatus === 'connecting' || connectionStatus === 'disconnected';

    return (
        <div className="chat-app">
            <header className="app-header"><h1>🔒 Secure Chat</h1>{roomId && <span className="room-badge">Room: {roomId}</span>}</header>
            <div className={`status-bar ${sc}`}>
                <span className="status-dot"></span><span>{st}</span>
                {callState === 'requesting' && <span>📞 Calling...</span>}
                {callState === 'ringing' && <span>📞 Incoming call!</span>}
                {isReconnecting && isInCall && <span style={{ color: '#ffd54f' }}>🔄 Reconnecting...</span>}
            </div>

            {callState === 'ringing' && (
                <div className="call-modal-overlay"><div className="call-modal"><div className="call-modal-icon">{incomingCallType === 'video' ? '📹' : '🎤'}</div><h2>Incoming {incomingCallType === 'video' ? 'Video' : 'Voice'} Call</h2><p>Your partner wants to start a call</p><div className="call-modal-actions"><button onClick={handleAcceptCall} className="btn btn-success btn-lg">✅ Accept</button><button onClick={handleRejectCall} className="btn btn-danger btn-lg">❌ Reject</button></div></div></div>
            )}

            <div className="main-content">
                {!roomCreated ? (
                    <div className="landing-page">
                        <div className="landing-card"><div className="landing-icon">🏠</div><h2>Create a New Room</h2><button onClick={() => webrtcService.current?.createRoom()} className="btn btn-success btn-full btn-lg">Create Room</button></div>
                        <div className="divider-text">OR</div>
                        <div className="landing-card"><div className="landing-icon">🚪</div><h2>Join Existing Room</h2>
                            {!showJoinInput ? <button onClick={() => setShowJoinInput(true)} className="btn btn-primary btn-full btn-lg">Join Room</button> :
                                <div className="join-input-group"><input value={joinRoomId} onChange={e => setJoinRoomId(e.target.value.toUpperCase())} placeholder="Room ID" maxLength={6} className="join-input" autoFocus /><button onClick={() => { webrtcService.current?.joinRoom(joinRoomId); setShowJoinInput(false); }} className="btn btn-success">Join</button><button onClick={() => setShowJoinInput(false)} className="btn btn-secondary">✕</button></div>}
                        </div>
                    </div>
                ) : (
                    <>
                        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

                        <div className="action-bar">
                            {isConnected && callState === 'idle' && (<><button onClick={() => handleStartCall('video')} className="btn btn-primary">📹 Video Call</button><button onClick={() => handleStartCall('voice')} className="btn btn-warning">🎤 Voice Call</button></>)}
                            {!isConnected && callState === 'idle' && <span className="waiting-badge">⏳ Waiting for partner... (Room: {roomId})</span>}
                            {callState === 'requesting' && <button onClick={handleEndCall} className="btn btn-danger">❌ Cancel</button>}
                            {callState === 'in-call' && <button onClick={handleEndCall} className="btn btn-danger">☎️ End Call</button>}
                            <button onClick={handleLeaveRoom} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>👋 Leave</button>
                        </div>
                        {isConnected && (
                            <button onClick={() => setShowMusicPlayer(!showMusicPlayer)} className="btn btn-secondary">
                                🎵 Music
                            </button>
                        )}
                        {isConnected && (
                            <button onClick={() => setShowDrawCanvas(!showDrawCanvas)} className="btn btn-secondary">
                                🎨 Draw
                            </button>
                        )}
                        {isInCall && (
                            <div ref={callAreaRef} className={`call-area ${isMobile ? 'mobile' : 'desktop'}`} style={{ height: isMobile ? '60vh' : `${callHeight}vh` }}>
                                <div className="video-panel main-video" style={{ flex: 1 }} onDoubleClick={swapVideos}>
                                    <video ref={mainVideoRef} autoPlay muted={mainIsLocal} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                    {showMainOff && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: 'white', zIndex: 5, gap: '8px' }}><span style={{ fontSize: '40px' }}>📷</span><span style={{ fontSize: '14px', color: '#f44336', fontWeight: 'bold' }}>Camera Off</span></div>}
                                    <span className="panel-label">{mainIsLocal ? 'YOU' : 'PARTNER'}</span>
                                    {mainIsLocal && <div className="panel-controls"><button onClick={toggleMute} className="icon-btn" style={{ background: isMuted ? '#f44336' : 'rgba(0,0,0,0.6)' }}>{isMuted ? '🔇' : '🎤'}</button>{callType === 'video' && <button onClick={toggleCamera} className="icon-btn" style={{ background: isCameraOff ? '#f44336' : 'rgba(0,0,0,0.6)' }}>{isCameraOff ? '📷❌' : '📷'}</button>}</div>}
                                </div>

                                <div ref={pipRef} className="pip-video" style={{ position: 'absolute', width: pipSize.w, height: pipSize.h, top: pipPos.y, left: pipPos.x, cursor: 'grab', zIndex: 20, transition: isDragging ? 'none' : 'all 0.3s ease' }}
                                    onMouseDown={onPiPStart} onTouchStart={onPiPStart} onDoubleClick={swapVideos}>
                                    <div className="pip-drag-handle"><span>⠿</span></div>
                                    <video ref={pipVideoRef} autoPlay muted={pipIsLocal} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    {showPipOff && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '12px', color: 'white', zIndex: 5 }}><span style={{ fontSize: '24px' }}>📷❌</span></div>}
                                    <span className="pip-label">{pipIsLocal ? 'YOU' : 'PARTNER'}</span>
                                </div>

                                {/* ✅ BULLETPROOF: Vertical resize with cleanup */}
                                <div className="resize-handle-v" onMouseDown={onResizeStart} onTouchStart={onResizeStart}>
                                    <div className="resize-handle-v-bar" />
                                </div>

                                {kissCloseness > 0.3 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 50, pointerEvents: 'none', opacity: kissCloseness }}><span style={{ fontSize: `${20 + kissCloseness * 30}px` }}>{kissCloseness > 0.8 ? '💕' : kissCloseness > 0.5 ? '💗' : '💓'}</span></div>}
                                {/* FIXED: Decoupled duplicate cleanup wrappers to streamline particle overlay rendering pipelines smoothly */}
                                {kissMatches.map(m => (
                                    <KissMatch
                                        key={m.id}
                                        match={m}
                                        onComplete={() => handleCompleteKiss(m.id)}
                                    />
                                ))}

                                <MusicPlayer
                                    isVisible={showMusicPlayer}
                                    musicService={musicSyncRef.current}
                                    isConnected={isConnected}
                                />
                                <LoveNotes
                                    isVisible={isInCall}
                                    onSendNote={handleSendLoveNote}
                                    receivedNotes={receivedLoveNotes}
                                />
                                <DrawCanvas
                                    isVisible={showDrawCanvas && isInCall}
                                    drawService={drawSyncRef.current}
                                    onSendStroke={handleSendStroke}
                                    onClearCanvas={handleClearCanvas}
                                    receivedStrokes={receivedDrawStrokes}
                                />
                                <TouchOverlay isVisible={isInCall} onTouchSend={(td) => { webrtcService.current?.sendTouchData(td); if (td.pattern === 'kiss') { kissSyncRef.current.registerMyTouch(td.timestamp || Date.now(), td.x, td.y, td.pattern); setTimeout(() => kissSyncRef.current.removeMyTouch(td.timestamp || Date.now()), 2000); } }} receivedTouches={receivedTouches} />
                            </div>
                        )}

                        <div className="chat-area">
                            <div className="messages-container">
                                {messages.length === 0 && <div className="empty-chat">{isConnected ? '💬 Start chatting...' : `📋 Share Room ID "${roomId}" with your partner`}</div>}
                                {messages.map(msg => <div key={msg.id} className={`message ${msg.fromMe ? 'sent' : 'received'}`}><div className="message-bubble">{msg.text}</div></div>)}
                                <div ref={messagesEndRef} />
                            </div>
                            <div className="input-area">
                                <button onClick={() => setShowEmojis(!showEmojis)} className="emoji-toggle-btn">😊</button>
                                <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} placeholder={isConnected ? "Type a message..." : "Waiting for partner..."} disabled={!isConnected} className="message-input" />
                                <button onClick={handleSendMessage} disabled={!isConnected} className="send-btn">➤</button>
                                {showEmojis && <EmojiPicker onSelect={(e) => setInputText(prev => prev + e)} />}
                                {showEmojis && <div onClick={() => setShowEmojis(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatRoom;