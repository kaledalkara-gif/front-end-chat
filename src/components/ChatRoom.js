import React, { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import './ChatRoom.css';


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
    const [localSize, setLocalSize] = useState(0.5); // 0.5 = 50% each
    const [callHeight, setCallHeight] = useState(40);
    const [showEmojis, setShowEmojis] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const webrtcService = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const service = new WebRTCService();
        webrtcService.current = service;

        service.onMessage = (text) => {
            setMessages(prev => [...prev, { text, fromMe: false, id: Date.now() }]);
        };

        service.onRemoteStream = (stream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
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
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        };

        service.onCallEnded = () => {
            setCallState('idle');
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        };

        service.onPeerLeft = () => {
            setIsConnected(false);
            setCallState('idle');
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        };

        service.onConnectionStateChange = (state) => {
            setConnectionState(state);

            // Show reconnecting message
            if (state === 'disconnected' || state === 'failed') {
                // Auto-reconnect handled by Socket.IO
            }
        };

        service.connect();
        return () => service.disconnect();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Add this useEffect in ChatRoom.js, near the other useEffects
    useEffect(() => {
        // Detect mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            // Ensure video elements have playsinline attribute
            if (localVideoRef.current) {
                localVideoRef.current.setAttribute('playsinline', 'true');
                localVideoRef.current.setAttribute('webkit-playsinline', 'true');
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.setAttribute('playsinline', 'true');
                remoteVideoRef.current.setAttribute('webkit-playsinline', 'true');
            }
        }
    }, [callState, isInCall]);

    // ============ CALL HANDLERS ============

    const handleStartCall = async (type) => {
        setCallType(type);
        setCallState('requesting');
        try {
            await webrtcService.current?.startCall(type);

            // Set local video with play attempt
            setTimeout(() => {
                const stream = webrtcService.current?.localStream;
                if (localVideoRef.current && stream) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play()
                        .then(() => console.log('✅ Local video playing on caller'))
                        .catch(e => {
                            console.log('Play failed, muting:', e.message);
                            localVideoRef.current.muted = true;
                            localVideoRef.current.play().catch(() => { });
                        });
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

            // Longer delay for mobile browsers
            setTimeout(() => {
                const stream = webrtcService.current?.localStream;
                if (localVideoRef.current && stream) {
                    localVideoRef.current.srcObject = stream;

                    // Force play with user gesture context
                    localVideoRef.current.play()
                        .then(() => {
                            console.log('✅ Local video playing on receiver');
                        })
                        .catch(e => {
                            console.log('Play failed, muting and retrying:', e.message);
                            localVideoRef.current.muted = true;
                            return localVideoRef.current.play();
                        })
                        .then(() => {
                            console.log('✅ Local video playing (muted)');
                        })
                        .catch(e => {
                            console.error('❌ Could not play video:', e.message);
                        });
                } else {
                    console.log('❌ Missing ref or stream - Ref:', !!localVideoRef.current, 'Stream:', !!stream);
                }
            }, 500); // Increased from 300ms for mobile
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
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
                        <div className="call-modal-icon">
                            {incomingCallType === 'video' ? '📹' : '🎤'}
                        </div>
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
                            <button onClick={() => webrtcService.current?.createRoom()} className="btn btn-success btn-full btn-lg">
                                Create Room
                            </button>
                        </div>

                        <div className="divider-text">OR</div>

                        <div className="landing-card">
                            <div className="landing-icon">🚪</div>
                            <h2>Join Existing Room</h2>
                            {!showJoinInput ? (
                                <button onClick={() => setShowJoinInput(true)} className="btn btn-primary btn-full btn-lg">
                                    Join Room
                                </button>
                            ) : (
                                <div className="join-input-group">
                                    <input
                                        value={joinRoomId}
                                        onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                                        placeholder="Room ID"
                                        maxLength={6}
                                        className="join-input"
                                        autoFocus
                                    />
                                    <button onClick={() => { webrtcService.current?.joinRoom(joinRoomId); setShowJoinInput(false); }} className="btn btn-success">
                                        Join
                                    </button>
                                    <button onClick={() => setShowJoinInput(false)} className="btn btn-secondary">
                                        ✕
                                    </button>
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
                                <span className="waiting-badge">⏳ Waiting for partner to join... (Room: {roomId})</span>
                            )}
                            {callState === 'requesting' && (
                                <button onClick={handleEndCall} className="btn btn-danger">❌ Cancel Request</button>
                            )}
                            {callState === 'in-call' && (
                                <button onClick={handleEndCall} className="btn btn-danger">☎️ End Call</button>
                            )}
                            <button onClick={handleLeaveRoom} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>👋 Leave</button>
                        </div>

                        {/* Call Area */}
                        {isInCall && (
                            <div style={{
                                display: 'flex',
                                gap: '4px',
                                padding: '12px 20px',
                                background: '#000',
                                minHeight: '200px',
                                height: `${callHeight}vh`,
                                position: 'relative',
                                transition: 'height 0.3s ease'
                            }}>
                                {/* Local Video */}
                                <div style={{
                                    flex: localSize,
                                    position: 'relative',
                                    background: '#1a1a1a',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    minWidth: '100px',
                                    transition: 'flex 0.3s ease'
                                }}>
                                    {callType === 'video' ? (
                                        <video ref={localVideoRef} autoPlay muted playsInline
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                    ) : (
                                        <div style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                            justifyContent: 'center', height: '100%', color: 'white', gap: '8px'
                                        }}>
                                            <span style={{ fontSize: 'clamp(30px, 6vw, 50px)' }}>🎤</span>
                                            <span style={{ fontSize: 'clamp(12px, 2vw, 14px)' }}>Microphone active</span>
                                        </div>
                                    )}
                                    <span style={{
                                        position: 'absolute', bottom: '8px', left: '8px',
                                        background: 'rgba(0,0,0,0.7)', color: 'white',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', zIndex: 5
                                    }}>YOU</span>

                                    {/* Size controls */}
                                    <div style={{
                                        position: 'absolute', top: '6px', right: '6px',
                                        display: 'flex', gap: '3px', zIndex: 10
                                    }}>
                                        <button onClick={() => setLocalSize(Math.max(0.2, localSize - 0.1))}
                                            style={resizeBtnStyle} title="Make smaller">−</button>
                                        <button onClick={() => setLocalSize(Math.min(0.8, localSize + 0.1))}
                                            style={resizeBtnStyle} title="Make larger">+</button>
                                    </div>
                                </div>

                                {/* Horizontal Resize Handle */}
                                <div
                                    style={{
                                        width: '6px',
                                        cursor: 'col-resize',
                                        background: 'rgba(255,255,255,0.2)',
                                        borderRadius: '3px',
                                        flexShrink: 0,
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const startX = e.clientX;
                                        const startSize = localSize;
                                        const onMouseMove = (me) => {
                                            const w = e.target.parentElement.offsetWidth;
                                            const d = (me.clientX - startX) / w;
                                            setLocalSize(Math.max(0.2, Math.min(0.8, startSize + d)));
                                        };
                                        const onMouseUp = () => {
                                            document.removeEventListener('mousemove', onMouseMove);
                                            document.removeEventListener('mouseup', onMouseUp);
                                        };
                                        document.addEventListener('mousemove', onMouseMove);
                                        document.addEventListener('mouseup', onMouseUp);
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.5)'}
                                    onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        const startX = e.touches[0].clientX;
                                        const startSize = localSize;
                                        const onTouchMove = (me) => {
                                            const w = e.target.parentElement.offsetWidth;
                                            const d = (me.touches[0].clientX - startX) / w;
                                            setLocalSize(Math.max(0.2, Math.min(0.8, startSize + d)));
                                        };
                                        const onTouchEnd = () => {
                                            document.removeEventListener('touchmove', onTouchMove);
                                            document.removeEventListener('touchend', onTouchEnd);
                                        };
                                        document.addEventListener('touchmove', onTouchMove, { passive: false });
                                        document.addEventListener('touchend', onTouchEnd);
                                    }}
                                />

                                {/* Remote Video */}
                                <div style={{
                                    flex: 1 - localSize,
                                    position: 'relative',
                                    background: '#1a1a1a',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    minWidth: '100px',
                                    transition: 'flex 0.3s ease'
                                }}>
                                    {callType === 'video' ? (
                                        <video ref={remoteVideoRef} autoPlay playsInline
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                    ) : (
                                        <>
                                            <div style={{
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                justifyContent: 'center', height: '100%', color: '#4caf50', gap: '8px'
                                            }}>
                                                <span style={{ fontSize: 'clamp(30px, 6vw, 50px)' }}>🔊</span>
                                                <span style={{ fontSize: 'clamp(12px, 2vw, 14px)' }}>Partner speaking</span>
                                            </div>
                                            <audio ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                                        </>
                                    )}
                                    <span style={{
                                        position: 'absolute', bottom: '8px', left: '8px',
                                        background: 'rgba(0,0,0,0.7)', color: 'white',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px', zIndex: 5
                                    }}>PARTNER</span>

                                    {/* Size controls */}
                                    <div style={{
                                        position: 'absolute', top: '6px', right: '6px',
                                        display: 'flex', gap: '3px', zIndex: 10
                                    }}>
                                        <button onClick={() => setLocalSize(Math.min(0.8, localSize + 0.1))}
                                            style={resizeBtnStyle} title="Make partner smaller">−</button>
                                        <button onClick={() => setLocalSize(Math.max(0.2, localSize - 0.1))}
                                            style={resizeBtnStyle} title="Make partner larger">+</button>
                                    </div>
                                </div>

                                {/* Vertical Resize Handle - at the bottom */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '-2px',
                                        left: '20px',
                                        right: '20px',
                                        height: '8px',
                                        cursor: 'row-resize',
                                        zIndex: 20
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        const startY = e.clientY;
                                        const startHeight = callHeight;
                                        const onMouseMove = (me) => {
                                            const delta = (startY - me.clientY) / window.innerHeight * 100;
                                            setCallHeight(Math.max(25, Math.min(70, startHeight + delta)));
                                        };
                                        const onMouseUp = () => {
                                            document.removeEventListener('mousemove', onMouseMove);
                                            document.removeEventListener('mouseup', onMouseUp);
                                        };
                                        document.addEventListener('mousemove', onMouseMove);
                                        document.addEventListener('mouseup', onMouseUp);
                                    }}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        const startY = e.touches[0].clientY;
                                        const startHeight = callHeight;
                                        const onTouchMove = (me) => {
                                            const delta = (startY - me.touches[0].clientY) / window.innerHeight * 100;
                                            setCallHeight(Math.max(25, Math.min(70, startHeight + delta)));
                                        };
                                        const onTouchEnd = () => {
                                            document.removeEventListener('touchmove', onTouchMove);
                                            document.removeEventListener('touchend', onTouchEnd);
                                        };
                                        document.addEventListener('touchmove', onTouchMove, { passive: false });
                                        document.addEventListener('touchend', onTouchEnd);
                                    }}
                                >
                                    {/* Visual handle bar */}
                                    <div style={{
                                        width: '60px',
                                        height: '4px',
                                        background: 'rgba(255,255,255,0.3)',
                                        borderRadius: '2px',
                                        margin: '2px auto',
                                        cursor: 'row-resize'
                                    }} />
                                </div>
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

                            {/* Input Area */}
                            <div className="input-area" style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowEmojis(!showEmojis)}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        background: showEmojis ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
                                        color: 'white',
                                        fontSize: '22px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background 0.2s'
                                    }}
                                    title="Emojis"
                                >
                                    😊
                                </button>

                                <input
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder={isConnected ? "Type a message..." : "Waiting for partner..."}
                                    disabled={!isConnected}
                                    className="message-input"
                                />

                                <button onClick={handleSendMessage} disabled={!isConnected} className="send-btn">
                                    ➤
                                </button>

                                {/* Emoji Picker */}
                                {showEmojis && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '60px',
                                        left: '12px',
                                        background: '#1e1e3a',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '16px',
                                        padding: '12px',
                                        width: 'calc(100% - 24px)',
                                        maxWidth: '500px',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                        zIndex: 100,
                                        animation: 'fadeIn 0.2s ease'
                                    }}>
                                        {/* Category Tabs */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '4px',
                                            marginBottom: '10px',
                                            flexWrap: 'wrap',
                                            position: 'sticky',
                                            top: 0,
                                            background: '#1e1e3a',
                                            paddingBottom: '8px',
                                            zIndex: 2
                                        }}>
                                            {Object.keys(EMOJIS).map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => {
                                                        const el = document.getElementById(`emoji-cat-${cat}`);
                                                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        color: 'white',
                                                        fontSize: '11px',
                                                        cursor: 'pointer',
                                                        textTransform: 'capitalize',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {cat === 'faces' ? '😀' : cat === 'hearts' ? '❤️' : cat === 'gestures' ? '👍' :
                                                        cat === 'party' ? '🎉' : cat === 'animals' ? '🐶' : cat === 'food' ? '🍎' :
                                                            cat === 'travel' ? '✈️' : cat === 'objects' ? '📱' : '🔴'} {cat}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Emoji Grid */}
                                        {Object.entries(EMOJIS).map(([category, emojis]) => (
                                            <div key={category} id={`emoji-cat-${category}`}>
                                                <div style={{
                                                    color: 'rgba(255,255,255,0.5)',
                                                    fontSize: '11px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px',
                                                    marginBottom: '6px',
                                                    marginTop: '12px',
                                                    paddingLeft: '4px'
                                                }}>
                                                    {category}
                                                </div>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                                                    gap: '4px',
                                                    marginBottom: '8px'
                                                }}>
                                                    {emojis.map((emoji, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setInputText(prev => prev + emoji);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                aspectRatio: '1',
                                                                fontSize: 'clamp(18px, 3.5vw, 24px)',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                background: 'transparent',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'background 0.15s'
                                                            }}
                                                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                            title={emoji}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Click outside to close */}
                                {showEmojis && (
                                    <div
                                        onClick={() => setShowEmojis(false)}
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            zIndex: 99
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const resizeBtnStyle = {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.5)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)'
};

const EMOJIS = {
    faces: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👻', '💪', '👍', '👎', '👏', '🙌', '🤝', '🙏', '💅'],

    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],

    gestures: ['👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙'],

    party: ['🎉', '🎊', '🎈', '🎂', '🎀', '🎁', '🎃', '🎄', '🎅', '🎆', '🎇', '✨', '🎵', '🎶', '🎤', '🎧', '🎼', '🎹', '🥁', '🎸', '🎺', '🎷', '🎻', '🪕', '🎯', '🎮', '🎰', '🎲', '🎳', '🎾', '⚽', '🏀', '🏈', '⚾', '🥎', '🎱', '🏆', '🥇', '🥈', '🥉'],

    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️'],

    food: ['🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯'],

    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🚄', '🚅', '🚈', '🚝', '🚂', '✈️', '🚁', '🛩️', '🚀', '🛸', '⛵', '🚤', '🛳️', '⛴️', '🏠', '🏡', '🏢', '🏰', '🏯', '🗽', '🗼', '⛲', '🌍', '🌎', '🌏', '🌋', '🏔️', '⛰️', '🏕️', '🏖️', '🏜️', '🏝️', '🌅', '🌄', '🌈', '☀️', '🌤️', '⛅', '🌦️', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️', '⛄', '🌊', '🔥', '💧', '🌟', '⭐', '🌙', '☄️', '💫', '🪐'],

    objects: ['📱', '💻', '⌚', '📷', '🎥', '💡', '🔦', '📚', '📖', '💰', '💳', '💎', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🔫', '🪃', '🏹', '🛡️', '🔧', '🔩', '⚙️', '🗜️', '⚖️', '🦯', '🔗', '⛓️', '🪝', '🧰', '🧲', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🧹', '🧺', '🧻', '🚽', '🚿', '🛁', '🧼', '🪥', '🪒', '🧴', '🧷', '🧹'],

    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '✅', '❌', '⚠️', '🚫', '➕', '➖', '➗', '✖️', '♾️', '⁉️', '❓', '❔', '❗', '❕', '〰️', '💲', '💱', '©️', '®️', '™️', '♻️', '🔱', '⭕', '☑️', '✔️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫']
};

export default ChatRoom;