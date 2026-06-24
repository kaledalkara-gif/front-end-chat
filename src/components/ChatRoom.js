import React, { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import { HapticService, TOUCH_PATTERNS } from '../services/HapticService';
import TouchOverlay from './TouchOverlay';
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
    const [localSize, setLocalSize] = useState(0.5);
    const [callHeight, setCallHeight] = useState(40);
    const [showEmojis, setShowEmojis] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [receivedTouches, setReceivedTouches] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [mainIsLocal, setMainIsLocal] = useState(true);  // Main video shows local
    const [pipPos, setPipPos] = useState({ x: 10, y: 10 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const mainVideoRef = useRef(null);
    const pipVideoRef = useRef(null);
    const pipRef = useRef(null);

    // Derived values
    const pipIsLocal = !mainIsLocal;
    const showMainOff = mainIsLocal ? isCameraOff : false;
    const showPipOff = pipIsLocal ? isCameraOff : false;

    const webrtcService = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Detect screen resize
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize WebRTC
    useEffect(() => {
        const service = new WebRTCService();
        webrtcService.current = service;

        service.onMessage = (text) => {
            setMessages(prev => [...prev, { text, fromMe: false, id: Date.now() }]);
        };

        service.onRemoteStream = (stream) => {
            // Store remote stream in service
            // The sync useEffect will handle assigning it
            if (mainVideoRef.current && !mainIsLocal) {
                mainVideoRef.current.srcObject = stream;
            }
            if (pipVideoRef.current && !pipIsLocal) {
                pipVideoRef.current.srcObject = stream;
            }
        };

        service.onRoomCreated = (id) => { setRoomId(id); setRoomCreated(true); };
        service.onRoomJoined = (id) => { setRoomId(id); setIsConnected(true); setRoomCreated(true); };
        service.onPeerJoined = () => setIsConnected(true);

        service.onIncomingCall = (type) => {
            setIncomingCallType(type);
            setCallState('ringing');
        };

        service.onCallAccepted = () => {
            webrtcService.current?.onAcceptedByPeer();
            setCallState('in-call');
        };

        service.onCallRejected = () => {
            setCallState('idle');
            setIncomingCallType(null);
            clearMedia();
        };

        service.onCallEnded = () => {
            setCallState('idle');
            clearMedia();
        };

        service.onPeerLeft = () => {
            setIsConnected(false);
            setCallState('idle');
            clearMedia();
        };

        service.onTouchReceived = (touchData) => {
            const touchWithId = { ...touchData, id: Date.now() + Math.random() };
            setReceivedTouches(prev => [...prev.slice(-5), touchWithId]);
            HapticService.vibrate(touchData.pattern);
            setTimeout(() => {
                setReceivedTouches(prev => prev.filter(t => t.id !== touchWithId.id));
            }, TOUCH_PATTERNS[touchData.pattern]?.duration || 1500);
        };

        service.onError = (msg) => console.error(msg);
        service.connect();

        return () => service.disconnect();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Keep video refs updated
    useEffect(() => {
        const localStream = webrtcService.current?.localStream;
        const remoteStream = webrtcService.current?.remoteStream;

        // Main video shows the "mainIsLocal" person
        if (mainVideoRef.current) {
            const streamForMain = mainIsLocal ? localStream : remoteStream;
            if (streamForMain && mainVideoRef.current.srcObject !== streamForMain) {
                mainVideoRef.current.srcObject = streamForMain;
            }
        }

        // PIP shows the opposite person
        if (pipVideoRef.current) {
            const streamForPip = pipIsLocal ? localStream : remoteStream;
            if (streamForPip && pipVideoRef.current.srcObject !== streamForPip) {
                pipVideoRef.current.srcObject = streamForPip;
            }
        }
    }, [mainIsLocal, callState, webrtcService.current?.localStream, webrtcService.current?.remoteStream]);

    // ============ CALL HANDLERS ============

    const swapVideos = () => {
        setMainIsLocal(prev => !prev);
    };

    const startDrag = (e) => {
        e.preventDefault();
        setIsDragging(true);

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        dragStart.current = {
            x: clientX - pipPos.x,
            y: clientY - pipPos.y,
        };

        const onMove = (moveEvent) => {
            const cx = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const cy = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const parent = pipRef.current?.parentElement;
            if (!parent) return;

            const maxX = parent.offsetWidth - (pipRef.current?.offsetWidth || 120);
            const maxY = parent.offsetHeight - (pipRef.current?.offsetHeight || 160);

            setPipPos({
                x: Math.max(0, Math.min(maxX, cx - dragStart.current.x)),
                y: Math.max(0, Math.min(maxY, cy - dragStart.current.y)),
            });
        };

        const onEnd = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    const handleStartCall = async (type) => {
        setCallType(type);
        setCallState('requesting');
        try {
            await webrtcService.current?.startCall(type);

            setTimeout(() => {
                const stream = webrtcService.current?.localStream;

                if (stream) {
                    if (mainVideoRef.current) {
                        mainVideoRef.current.srcObject = stream;
                        mainVideoRef.current.play().catch(() => {
                            if (mainVideoRef.current) {
                                mainVideoRef.current.muted = true;
                                mainVideoRef.current.play().catch(() => { });
                            }
                        });
                    }
                    if (pipVideoRef.current) {
                        pipVideoRef.current.srcObject = stream;
                    }
                }
            }, 300);

        } catch (err) {
            console.error('Failed to start call:', err);
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

            setTimeout(() => {
                const stream = webrtcService.current?.localStream;

                if (stream) {
                    if (mainVideoRef.current) {
                        mainVideoRef.current.srcObject = stream;
                        mainVideoRef.current.play().catch(() => {
                            if (mainVideoRef.current) {
                                mainVideoRef.current.muted = true;
                                mainVideoRef.current.play().catch(() => { });
                            }
                        });
                    }
                    if (pipVideoRef.current) {
                        pipVideoRef.current.srcObject = stream;
                    }
                }
            }, 500);

        } catch (err) {
            console.error('Failed to accept call:', err);
            setCallState('idle');
            setIncomingCallType(null);
        }
    };

    const handleRejectCall = () => {
        webrtcService.current?.rejectCall();
        setCallState('idle');
        setIncomingCallType(null);
    };

    const handleEndCall = () => {
        webrtcService.current?.endCall();
        setCallState('idle');
        clearMedia();
    };

    const toggleMute = () => {
        const stream = webrtcService.current?.localStream;
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCamera = async () => {
        const stream = webrtcService.current?.localStream;
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!videoTrack.enabled);
            }
        }
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
    };

    const isInCall = callState === 'in-call' || callState === 'requesting';
    const statusClass = isInCall ? 'in-call' : isConnected ? 'connected' : roomCreated ? 'waiting' : 'ready';
    const statusText = isInCall ? '📹 In Call' : isConnected ? 'Connected' : roomCreated ? 'Waiting for partner' : 'Ready';

    // ============ RENDER ============

    return (
        <div className="chat-app">
            {/* Header */}
            <header className="app-header">
                <h1>🔒 Secure Chat</h1>
                {roomId && <span className="room-badge">Room: {roomId}</span>}
            </header>

            {/* Status Bar */}
            <div className={`status-bar ${statusClass}`}>
                <span className="status-dot"></span>
                <span>{statusText}</span>
                {callState === 'requesting' && <span>📞 Calling...</span>}
                {callState === 'ringing' && <span>📞 Incoming call!</span>}
            </div>

            {/* Incoming Call Modal */}
            {callState === 'ringing' && (
                <div className="call-modal-overlay">
                    <div className="call-modal">
                        <div className="call-modal-icon">{incomingCallType === 'video' ? '📹' : '🎤'}</div>
                        <h2>Incoming {incomingCallType === 'video' ? 'Video' : 'Voice'} Call</h2>
                        <p>Your partner wants to start a call</p>
                        <div className="call-modal-actions">
                            <button onClick={handleAcceptCall} className="btn btn-success btn-lg">✅ Accept</button>
                            <button onClick={handleRejectCall} className="btn btn-danger btn-lg">❌ Reject</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="main-content">
                {/* Landing Page */}
                {!roomCreated ? (
                    <div className="landing-page">
                        <div className="landing-card">
                            <div className="landing-icon">🏠</div>
                            <h2>Create a New Room</h2>
                            <button onClick={() => webrtcService.current?.createRoom()} className="btn btn-success btn-full btn-lg">Create Room</button>
                        </div>
                        <div className="divider-text">OR</div>
                        <div className="landing-card">
                            <div className="landing-icon">🚪</div>
                            <h2>Join Existing Room</h2>
                            {!showJoinInput ? (
                                <button onClick={() => setShowJoinInput(true)} className="btn btn-primary btn-full btn-lg">Join Room</button>
                            ) : (
                                <div className="join-input-group">
                                    <input value={joinRoomId} onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                                        placeholder="Room ID" maxLength={6} className="join-input" autoFocus />
                                    <button onClick={() => { webrtcService.current?.joinRoom(joinRoomId); setShowJoinInput(false); }} className="btn btn-success">Join</button>
                                    <button onClick={() => setShowJoinInput(false)} className="btn btn-secondary">✕</button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Action Bar */}
                        <div className="action-bar">
                            {isConnected && callState === 'idle' && (
                                <>
                                    <button onClick={() => handleStartCall('video')} className="btn btn-primary">📹 Video Call</button>
                                    <button onClick={() => handleStartCall('voice')} className="btn btn-warning">🎤 Voice Call</button>
                                </>
                            )}
                            {!isConnected && callState === 'idle' && (
                                <span className="waiting-badge">⏳ Waiting for partner... (Room: {roomId})</span>
                            )}
                            {callState === 'requesting' && (
                                <button onClick={handleEndCall} className="btn btn-danger">❌ Cancel</button>
                            )}
                            {callState === 'in-call' && (
                                <button onClick={handleEndCall} className="btn btn-danger">☎️ End Call</button>
                            )}
                            <button onClick={handleLeaveRoom} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>👋 Leave</button>
                        </div>

                        {/* Call Area */}
                        {isInCall && (
                            <div className={`call-area ${isMobile ? 'mobile' : 'desktop'}`}
                                style={{ height: isMobile ? '60vh' : `${callHeight}vh` }}>

                                {/* Main Video (full size) */}
                                <div
                                    className="video-panel main-video"
                                    style={{ flex: 1 }}
                                    onDoubleClick={swapVideos}
                                >
                                    <video ref={mainVideoRef} autoPlay muted playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />

                                    {showMainOff && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: 'white', zIndex: 5, gap: '8px'
                                        }}>
                                            <span style={{ fontSize: '40px' }}>📷</span>
                                            <span style={{ fontSize: '14px', color: '#f44336', fontWeight: 'bold' }}>Camera Off</span>
                                        </div>
                                    )}

                                    <span className="panel-label">{mainIsLocal ? 'YOU' : 'PARTNER'}</span>

                                    {/* Controls on main video */}
                                    {mainIsLocal && (
                                        <div className="panel-controls">
                                            <button onClick={toggleMute} className="icon-btn"
                                                style={{ background: isMuted ? '#f44336' : 'rgba(0,0,0,0.6)' }}>
                                                {isMuted ? '🔇' : '🎤'}
                                            </button>
                                            {callType === 'video' && (
                                                <button onClick={toggleCamera} className="icon-btn"
                                                    style={{ background: isCameraOff ? '#f44336' : 'rgba(0,0,0,0.6)' }}>
                                                    {isCameraOff ? '📷❌' : '📷'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Small Floating Video (Picture-in-Picture) */}
                                <div
                                    ref={pipRef}
                                    className="pip-video"
                                    style={{
                                        position: 'absolute',
                                        width: isMobile ? '120px' : '180px',
                                        height: isMobile ? '160px' : '240px',
                                        top: pipPos.y,
                                        left: pipPos.x,
                                        cursor: 'grab',
                                        zIndex: 20,
                                    }}
                                    onMouseDown={startDrag}
                                    onTouchStart={startDrag}
                                    onDoubleClick={swapVideos}
                                >
                                    <div className="pip-drag-handle">
                                        <span>⠿</span>
                                    </div>
                                    <video ref={pipVideoRef} autoPlay muted playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />

                                    {showPipOff && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '12px',
                                            color: 'white', zIndex: 5
                                        }}>
                                            <span style={{ fontSize: '24px' }}>📷❌</span>
                                        </div>
                                    )}

                                    <span className="pip-label">{pipIsLocal ? 'YOU' : 'PARTNER'}</span>
                                </div>

                                {/* Touch Overlay */}
                                <TouchOverlay
                                    isVisible={isInCall}
                                    onTouchSend={(touchData) => webrtcService.current?.sendTouchData(touchData)}
                                    receivedTouches={receivedTouches}
                                />
                            </div>
                        )}

                        {/* Chat Area */}
                        <div className="chat-area">
                            <div className="messages-container">
                                {messages.length === 0 && (
                                    <div className="empty-chat">
                                        {isConnected ? '💬 Start chatting...' : `📋 Share Room ID "${roomId}" with your partner`}
                                    </div>
                                )}
                                {messages.map(msg => (
                                    <div key={msg.id} className={`message ${msg.fromMe ? 'sent' : 'received'}`}>
                                        <div className="message-bubble">{msg.text}</div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="input-area">
                                <button onClick={() => setShowEmojis(!showEmojis)} className="emoji-toggle-btn">😊</button>
                                <input value={inputText} onChange={e => setInputText(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder={isConnected ? "Type a message..." : "Waiting for partner..."}
                                    disabled={!isConnected} className="message-input" />
                                <button onClick={handleSendMessage} disabled={!isConnected} className="send-btn">➤</button>

                                {showEmojis && (
                                    <div className="emoji-picker-container">
                                        <div className="emoji-categories">
                                            {Object.keys(EMOJIS).map(cat => (
                                                <button key={cat} onClick={() => document.getElementById(`emoji-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth' })}
                                                    className="emoji-cat-btn">{cat}</button>
                                            ))}
                                        </div>
                                        {Object.entries(EMOJIS).map(([category, emojis]) => (
                                            <div key={category} id={`emoji-cat-${category}`}>
                                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', margin: '8px 0 4px' }}>{category}</div>
                                                <div className="emoji-grid">
                                                    {emojis.map((emoji, i) => (
                                                        <button key={i} onClick={() => { setInputText(prev => prev + emoji); }} className="emoji-item">{emoji}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
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