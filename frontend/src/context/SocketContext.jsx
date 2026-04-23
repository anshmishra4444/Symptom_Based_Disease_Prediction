import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [inferenceStatus, setInferenceStatus] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        socketRef.current = io('http://localhost:5000', {
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });

        socketRef.current.on('connect', () => setConnected(true));
        socketRef.current.on('disconnect', () => setConnected(false));

        socketRef.current.on('inference-status', (data) => {
            setInferenceStatus(data);
            // Auto-clear after completion
            if (data.progress === 100) {
                setTimeout(() => setInferenceStatus(null), 3000);
            }
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    const clearStatus = () => setInferenceStatus(null);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, inferenceStatus, connected, clearStatus }}>
            {children}
        </SocketContext.Provider>
    );
};
