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

        service.connect();
        return () => service.disconnect();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ============ CALL HANDLERS ============

    const handleStartCall = async (type) => {
        setCallType(type);
        setCallState('requesting');
        try {
            await webrtcService.current?.startCall(type);
            if (localVideoRef.current && webrtcService.current?.localStream) {
                localVideoRef.current.srcObject = webrtcService.current.localStream;
            }
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
            setTimeout(() => {
                if (localVideoRef.current && webrtcService.current?.localStream) {
                    localVideoRef.current.srcObject = webrtcService.current.localStream;
                }
            }, 300);
        } catch (err) {
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
                            <div className="call-area">
                                <div className="video-box">
                                    {callType === 'video' ? (
                                        <video ref={localVideoRef} autoPlay muted playsInline />
                                    ) : (
                                        <div className="audio-indicator">
                                            <span className="audio-icon">🎤</span>
                                            <span>Microphone active</span>
                                        </div>
                                    )}
                                    <span className="video-label">YOU</span>
                                </div>
                                <div className="video-box">
                                    {callType === 'video' ? (
                                        <video ref={remoteVideoRef} autoPlay playsInline />
                                    ) : (
                                        <>
                                            <div className="audio-indicator">
                                                <span className="audio-icon">🔊</span>
                                                <span>Partner speaking</span>
                                            </div>
                                            <audio ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                                        </>
                                    )}
                                    <span className="video-label">PARTNER</span>
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

                            <div className="input-area">
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
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatRoom;