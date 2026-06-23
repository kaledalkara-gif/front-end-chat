import React, { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';

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
            console.log('📥 Setting remote video');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
        };

        service.onRoomCreated = (id) => {
            setRoomId(id);
            setRoomCreated(true);
        };

        service.onRoomJoined = (id) => {
            setRoomId(id);
            setIsConnected(true);
            setRoomCreated(true);
        };

        service.onPeerJoined = () => {
            setIsConnected(true);
        };

        service.onIncomingCall = (type) => {
            setIncomingCallType(type);
            setCallState('ringing');
        };

        service.onCallAccepted = () => {
            // Initiator: peer accepted, now create offer
            console.log('📤 Peer accepted, triggering offer...');
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

        service.onError = (msg) => console.error(msg);
        service.connect();

        return () => service.disconnect();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ============ CALL ACTIONS ============

    const handleStartCall = async (type) => {
        console.log('📞 Starting call:', type);
        setCallType(type);
        setCallState('requesting');

        try {
            await webrtcService.current?.startCall(type);

            // Show local video
            if (localVideoRef.current && webrtcService.current?.localStream) {
                localVideoRef.current.srcObject = webrtcService.current.localStream;
            }
        } catch (err) {
            console.error('Failed to start call:', err);
            setCallState('idle');
        }
    };

    const handleAcceptCall = async () => {
        const type = incomingCallType || 'video';
        setCallType(type);

        try {
            // 1. Get local media first
            await webrtcService.current?.acceptIncomingCall(type);

            // 2. Update state to show video area
            setCallState('in-call');
            setIncomingCallType(null);

            // 3. Wait for React to render the video element, THEN set the stream
            setTimeout(() => {
                const stream = webrtcService.current?.localStream;
                console.log('🎥 Setting local video on receiver. Stream:', !!stream, 'Ref:', !!localVideoRef.current);
                if (localVideoRef.current && stream) {
                    localVideoRef.current.srcObject = stream;
                    console.log('✅ Local video set on receiver!');
                } else {
                    console.log('❌ Failed - Stream:', !!stream, 'Ref:', !!localVideoRef.current);
                    // Retry once more
                    setTimeout(() => {
                        if (localVideoRef.current && stream) {
                            localVideoRef.current.srcObject = stream;
                            console.log('✅ Local video set on retry');
                        }
                    }, 500);
                }
            }, 300);

        } catch (err) {
            console.error('Failed to accept:', err);
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

    return (
        <div style={{ padding: '10px', fontFamily: 'Arial', maxWidth: '900px', margin: '0 auto' }}>
            <h2>🔒 Secure Chat {roomId && <span style={{ color: '#666', fontSize: '16px' }}>- Room: {roomId}</span>}</h2>

            <div style={{
                background: isConnected ? '#4caf50' : roomCreated ? '#ff9800' : '#2196f3',
                color: 'white', padding: '8px 15px', marginBottom: '10px', borderRadius: '5px',
                display: 'flex', gap: '15px', flexWrap: 'wrap'
            }}>
                <span>{isConnected ? '🟢 Connected' : roomCreated ? '🟡 Waiting' : '🔵 Ready'}</span>
                {callState === 'in-call' && <span>📹 In Call</span>}
                {callState === 'requesting' && <span>📞 Calling...</span>}
                {callState === 'ringing' && <span>📞 Incoming!</span>}
            </div>

            {/* Incoming Call Popup */}
            {callState === 'ringing' && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '60px' }}>{incomingCallType === 'video' ? '📹' : '🎤'}</div>
                        <h2>Incoming {incomingCallType} Call</h2>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
                            <button onClick={handleAcceptCall} style={btn('#4caf50')}>✅ Accept</button>
                            <button onClick={handleRejectCall} style={btn('#f44336')}>❌ Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Area */}
            {/* Video Area */}
            {isInCall && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', minHeight: '250px', border: '3px solid #333', padding: '8px', background: '#000', borderRadius: '8px' }}>
                    {/* Local */}
                    <div style={{ flex: 1, position: 'relative', background: '#222', borderRadius: '5px', overflow: 'hidden' }}>
                        {callType === 'video' ? (
                            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', fontSize: '50px', flexDirection: 'column' }}>
                                <div>🎤</div>
                                <div style={{ fontSize: '14px', marginTop: '10px' }}>Microphone active</div>
                            </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}>YOU</div>
                    </div>

                    {/* Remote */}
                    <div style={{ flex: 1, position: 'relative', background: '#222', borderRadius: '5px', overflow: 'hidden' }}>
                        {callType === 'video' ? (
                            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4caf50', fontSize: '50px', flexDirection: 'column' }}>
                                    <div>🔊</div>
                                    <div style={{ fontSize: '14px', marginTop: '10px' }}>Partner speaking</div>
                                </div>
                                {/* Hidden audio element for voice calls */}
                                <audio ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                            </>
                        )}
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '12px' }}>PARTNER</div>
                    </div>
                </div>
            )}

            {/* Buttons */}
            <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!roomCreated ? (
                    <>
                        <button onClick={() => webrtcService.current?.createRoom()} style={btn('#4caf50')}>🏠 Create Room</button>
                        {!showJoinInput ? (
                            <button onClick={() => setShowJoinInput(true)} style={btn('#2196f3')}>🚪 Join Room</button>
                        ) : (
                            <>
                                <input value={joinRoomId} onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                                    placeholder="Room ID" maxLength={6}
                                    style={{ padding: '12px', fontSize: '18px', width: '130px', textAlign: 'center', letterSpacing: '3px' }} autoFocus />
                                <button onClick={() => { webrtcService.current?.joinRoom(joinRoomId); setShowJoinInput(false); }} style={btn('#4caf50')}>Join</button>
                                <button onClick={() => setShowJoinInput(false)} style={btn('#999')}>Cancel</button>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {isConnected && callState === 'idle' && (
                            <>
                                <button onClick={() => handleStartCall('video')} style={btn('#2196f3')}>📹 Video Call</button>
                                <button onClick={() => handleStartCall('voice')} style={btn('#ff9800')}>🎤 Voice Call</button>
                            </>
                        )}
                        {!isConnected && callState === 'idle' && (
                            <span style={{ padding: '12px 20px', background: '#fff3cd', borderRadius: '8px', color: '#856404', fontWeight: 'bold' }}>
                                ⏳ Waiting for partner... (Room: {roomId})
                            </span>
                        )}
                        {callState === 'requesting' && (
                            <button onClick={handleEndCall} style={btn('#f44336')}>❌ Cancel</button>
                        )}
                        {callState === 'in-call' && (
                            <button onClick={handleEndCall} style={btn('#f44336')}>☎️ End Call</button>
                        )}
                        <button onClick={handleLeaveRoom} style={btn('#999')}>👋 Leave Room</button>
                    </>
                )}
            </div>

            {/* Chat */}
            {roomCreated && (
                <>
                    <div style={{ border: '1px solid #ddd', height: '250px', overflowY: 'auto', padding: '10px', marginBottom: '10px', background: '#f5f5f5', borderRadius: '5px' }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#999', paddingTop: '100px' }}>
                                {isConnected ? 'Start chatting...' : `Share Room ID "${roomId}"`}
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} style={{ textAlign: msg.fromMe ? 'right' : 'left', marginBottom: '8px' }}>
                                <span style={{ display: 'inline-block', padding: '8px 14px', background: msg.fromMe ? '#2196f3' : '#e0e0e0', color: msg.fromMe ? 'white' : 'black', borderRadius: '15px', maxWidth: '70%', wordBreak: 'break-word' }}>
                                    {msg.text}
                                </span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input value={inputText} onChange={e => setInputText(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                            placeholder={isConnected ? "Type..." : "Waiting..."}
                            disabled={!isConnected}
                            style={{ flex: 1, padding: '12px', fontSize: '15px', border: '1px solid #ddd', borderRadius: '20px', outline: 'none', background: isConnected ? 'white' : '#e9e9e9' }} />
                        <button onClick={handleSendMessage} disabled={!isConnected}
                            style={{ padding: '12px 25px', background: isConnected ? '#2196f3' : '#ccc', color: 'white', border: 'none', borderRadius: '20px', cursor: isConnected ? 'pointer' : 'not-allowed', fontSize: '15px' }}>
                            Send
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const btn = (bg) => ({
    padding: '12px 20px', fontSize: '15px', background: bg,
    color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
});

export default ChatRoom;