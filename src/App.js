import React, { useState } from 'react';
import ChatRoom from './components/ChatRoom';
import WelcomeScreen from './components/WelcomeScreen';
import './App.css';

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  return (
    <div className="App">
      {!isUnlocked ? (
        <WelcomeScreen onEnter={() => setIsUnlocked(true)} />
      ) : (
        <ChatRoom />
      )}
    </div>
  );
}

export default App;