import React, { useState, useRef, useEffect } from 'react';
import { chatbotAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const ChatBot = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm **Vita**, your AI health assistant. ${
                user?.role === 'doctor'
                    ? 'I can help you with clinical decision support, differential diagnoses, and interpreting AI reports.'
                    : 'I can help you understand your symptoms, explain your diagnoses, and answer health questions.'
            } How can I help you today?`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen]);

    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await chatbotAPI.send(newMessages);
            const reply = res.data?.response || res.data?.message || 'I received your message but got an empty response. Please try again.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (err) {
            const serverMsg = err.response?.data?.message;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: serverMsg || 'Sorry, I\'m having trouble connecting right now. Please ensure the backend and ML API are running and your Gemini API key is configured.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            content: `Hi again! How can I help you, ${user?.name?.split(' ')[0] || 'there'}?`
        }]);
    };

    // Quick prompts based on role
    const quickPrompts = user?.role === 'doctor'
        ? ['Explain differential for fever + rash', 'What are signs of sepsis?', 'Interpret a high RF confidence score']
        : ['What does my diagnosis mean?', 'What foods should I avoid?', 'When should I see a doctor?'];

    const renderMessage = (content) => {
        // Guard against undefined/null content to prevent runtime crash
        if (!content) return '';
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(o => !o)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #10b981)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
                    zIndex: 9999,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                title="Chat with Vita AI"
                aria-label="Open AI Assistant"
            >
                {isOpen ? '✕' : '💬'}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '90px',
                    right: '24px',
                    width: '380px',
                    maxWidth: 'calc(100vw - 48px)',
                    height: '520px',
                    background: 'rgba(10,10,26,0.97)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.1)',
                    zIndex: 9998,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s ease',
                }}>
                    {/* Header */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.15))',
                        padding: '16px 18px',
                        borderBottom: '1px solid rgba(99,102,241,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #10b981)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.1rem', boxShadow: '0 0 12px rgba(99,102,241,0.4)'
                            }}>⚕️</div>
                            <div>
                                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
                                    Vita AI Assistant
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                    {user?.role === 'doctor' ? 'Clinical Decision Support' : 'Health Assistant'} · Gemini AI
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={clearChat}
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            Clear
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '16px',
                        display: 'flex', flexDirection: 'column', gap: '12px',
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: '8px',
                                alignItems: 'flex-end',
                            }}>
                                {msg.role === 'assistant' && (
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>
                                        ⚕️
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '78%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                        : 'rgba(255,255,255,0.06)',
                                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    fontSize: '0.85rem',
                                    lineHeight: '1.6',
                                    color: msg.role === 'user' ? 'white' : 'var(--text-secondary)',
                                }}
                                    dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                                />
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>⚕️</div>
                                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {[0, 1, 2].map(d => (
                                        <span key={d} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Prompts (only show if only 1 message — the greeting) */}
                    {messages.length === 1 && (
                        <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {quickPrompts.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setInput(p); inputRef.current?.focus(); }}
                                    style={{
                                        background: 'rgba(99,102,241,0.1)',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        borderRadius: '12px',
                                        padding: '5px 10px',
                                        fontSize: '0.72rem',
                                        color: 'var(--primary-light)',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        textAlign: 'left',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <form
                        onSubmit={sendMessage}
                        style={{
                            padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
                        }}
                    >
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Ask Vita anything…"
                            disabled={loading}
                            style={{
                                flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', padding: '10px 14px', color: 'var(--text-primary)',
                                fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            style={{
                                width: '38px', height: '38px', borderRadius: '12px',
                                background: input.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #10b981)' : 'rgba(255,255,255,0.06)',
                                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', transition: 'all 0.2s', flexShrink: 0,
                            }}
                            title="Send message"
                        >
                            {loading ? '⏳' : '➤'}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default ChatBot;
