import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [inferenceStatus, setInferenceStatus] = useState(null);
    const [connected, setConnected] = useState(false);

    // ✅ FIXED: Proper backend URL handling (Render safe)
    const SOCKET_URL =
        process.env.REACT_APP_BACKEND_URL?.replace("/api", "") ||
        "https://symptom-based-disease-prediction-2.onrender.com";

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"], // stable on Render
            reconnection: true,
            reconnectionAttempts: Infinity,
            timeout: 20000,
        });

        socketRef.current = socket;

        // Connection events
        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));

        // ML inference status updates
        socket.on("inference-status", (data) => {
            setInferenceStatus(data);

            // Auto-clear after completion
            if (data?.progress === 100) {
                setTimeout(() => setInferenceStatus(null), 3000);
            }
        });

        // Cleanup
        return () => {
            socket.disconnect();
        };
    }, [SOCKET_URL]);

    const clearStatus = () => setInferenceStatus(null);

    return (
        <SocketContext.Provider
            value={{
                socket: socketRef.current,
                inferenceStatus,
                connected,
                clearStatus,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};


// import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
// import { io } from 'socket.io-client';

// const SocketContext = createContext(null);

// export const useSocket = () => useContext(SocketContext);

// export const SocketProvider = ({ children }) => {
//     const socketRef = useRef(null);
//     const [inferenceStatus, setInferenceStatus] = useState(null);
//     const [connected, setConnected] = useState(false);

//     const SOCKET_URL =
//         process.env.REACT_APP_BACKEND_URL ||
//         "https://symptom-based-disease-prediction-2.onrender.com";
//     useEffect(() => {
//             socketRef.current = io(SOCKET_URL, {
//             transports: ["websocket"],
//             reconnectionAttempts: 5,
//         });

//         socketRef.current.on('connect', () => setConnected(true));
//         socketRef.current.on('disconnect', () => setConnected(false));

//         socketRef.current.on('inference-status', (data) => {
//             setInferenceStatus(data);
//             // Auto-clear after completion
//             if (data.progress === 100) {
//                 setTimeout(() => setInferenceStatus(null), 3000);
//             }
//         });

//         return () => {
//             socketRef.current?.disconnect();
//         };
//     }, []);

//     const clearStatus = () => setInferenceStatus(null);

//     return (
//         <SocketContext.Provider value={{ socket: socketRef.current, inferenceStatus, connected, clearStatus }}>
//             {children}
//         </SocketContext.Provider>
//     );
// };
