import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeft,
    Activity,
    Sparkles,
    Paperclip,
    Send,
    X,
    FileText,
    FileUp,
    Database,
    Trash2,
} from "lucide-react";

import "../styles/chat.css";
import logo from "../assets/vismed-logo.png";

export default function ChatPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showUpload, setShowUpload] = useState(false);
    const [loading, setLoading] = useState(false);

    // State untuk history sidebar
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);

    // -------------------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------------------

    const handleUpload = (event) => {
        const selectedFiles = Array.from(event.target.files || []);

        const mappedFiles = selectedFiles.map((file) => {
            const isImage = file.type.startsWith("image/");
            return {
                name: file.name,
                size: `${(file.size / 1024).toFixed(1)} KB`,
                preview: isImage ? URL.createObjectURL(file) : null,
                raw: file,
            };
        });

        setFiles((prev) => [...prev, ...mappedFiles]);
        event.target.value = null;
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleInput = (e) => {
        const textarea = e.target;
        setMessage(textarea.value);

        textarea.style.height = "auto";
        const maxHeight = 120;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // -------------------------------------------------------------------------
    // Data Functions
    // -------------------------------------------------------------------------

    const updateChatMessages = (chatId, newMessages) => {
        setChats((prev) =>
            prev.map((chat) =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: newMessages,
                        title:
                            chat.messages.length === 0 && newMessages.length > 0
                                ? newMessages[0]?.text?.slice(0, 25) || "New Chat"
                                : chat.title,
                    }
                    : chat
            )
        );
    };

    const sendMessage = async () => {
        if ((!message.trim() && files.length === 0) || loading) return;

        let chatId = activeChatId;

        // Auto create chat
        if (!chatId) {
            const newChat = {
                id: Date.now(),
                title: "New Chat",
                messages: [],
                createdAt: new Date(),
            };

            setChats((prev) => [newChat, ...prev]);
            setActiveChatId(newChat.id);
            chatId = newChat.id;
        }

        const userPrompt = message;
        const currentFiles = [...files];
        const fileNames = currentFiles.map(f => f.name).join(", ");

        const userMsg = {
            role: "user",
            text: userPrompt,
            files: currentFiles,
        };

        // Update message + chat
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        updateChatMessages(chatId, updatedMessages);

        setMessage("");
        setFiles([]);
        setLoading(true);

        try {
            const response = await axios.get("/ai/chatbot", {
                params: {
                    prompt: userPrompt + (fileNames ? ` [FILES: ${fileNames}]` : ""),
                },
            });

            const aiMsg = {
                role: "ai",
                text: response.data.response || "Tidak ada response dari AI.",
            };

            setMessages((prev) => {
                const updated = [...prev, aiMsg];

                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId
                            ? { ...chat, messages: updated }
                            : chat
                    )
                );

                return updated;
            });

        } catch (err) {
            const aiMsg = {
                role: "ai",
                text:
                    err.response?.data?.error ||
                    "Gagal menghubungi AI. Pastikan backend aktif.",
            };

            setMessages((prev) => {
                const updated = [...prev, aiMsg];

                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId
                            ? { ...chat, messages: updated }
                            : chat
                    )
                );

                return updated;
            });
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // Sidebar Functions
    // -------------------------------------------------------------------------

    const deleteChat = (chatId) => {
        if (!window.confirm("Hapus chat ini?")) return;

        const updatedChats = chats.filter(c => c.id !== chatId);
        setChats(updatedChats);

        if (chatId === activeChatId) {
            if (updatedChats.length > 0) {
                setActiveChatId(updatedChats[0].id);
                setMessages(updatedChats[0].messages);
            } else {
                setActiveChatId(null);
                setMessages([]);
            }
        }
    };

    const clearAllChats = () => {
        if (!window.confirm("Hapus semua chat?")) return;

        setChats([]);
        setMessages([]);
        setActiveChatId(null);
        localStorage.removeItem("chat_history");
    };

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest(".chatx-upload-wrapper")) {
                setShowUpload(false);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Load chat from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("chat_history");
        if (saved) {
            const parsed = JSON.parse(saved);
            setChats(parsed);

            if (parsed.length > 0) {
                setActiveChatId(parsed[0].id);
                setMessages(parsed[0].messages);
            }
        }
    }, []);

    // Save chat to localStorage
    useEffect(() => {
        localStorage.setItem("chat_history", JSON.stringify(chats));
    }, [chats]);

    // Update messages when switching chats
    useEffect(() => {
        if (!activeChatId) return;

        const activeChat = chats.find(c => c.id === activeChatId);
        if (activeChat) {
            setMessages(activeChat.messages);
        }
    }, [activeChatId, chats]);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    return (
    <div className="chatx-root">
      {/* SIDEBAR */}
        <aside className="chatx-sidebar">
            <button
                className="chatx-newchat"
                onClick={() => {
                    const newChat = {
                    id: Date.now(),
                    title: "New Chat",
                    messages: [],
                    createdAt: new Date(),
                    };

                    setChats((prev) => [newChat, ...prev]);
                    setActiveChatId(newChat.id);
                    setMessages([]);
                }}
                >
                + New Chat
            </button>

            <button
                className="chatx-clear-btn"
                onClick={clearAllChats}
                >
                Clear All
            </button>

            <div className="chatx-history">
            {chats.map((chat) => (
                <div
                    key={chat.id}
                    className={`chatx-history-item ${
                    chat.id === activeChatId ? "active" : ""
                    }`}
                    onClick={() => {
                    setActiveChatId(chat.id);
                    setMessages(chat.messages);
                    }}
                >
                    <div className="chatx-history-content">
                        <span>{chat.title}</span>

                        <button
                            className="chatx-delete-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                            }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ))}
            </div>
        </aside>

        {/* MAIN */}
        <div className="chatx-main">
            <header className="chatx-header">
            <div className="chatx-logo-area">
                <div
                    className="chatx-back"
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate("/dashboard"); // fallback
                        }
                    }}
                >
                    <ArrowLeft size={20} />
                </div>
                <img src={logo} className="chatx-logo-img" alt="logo" />
                <span className="chatx-logo-text">VisMed Ai</span>
            </div>
            <div className="chatx-status">● Online</div>
            </header>

            {/* CONTENT */}
            <div className="chatx-content">

            {/* EMPTY STATE */}
            {messages.length === 0 ? (
                <div className="chatx-empty">
                <h2 className="chatx-title">
                    What can I help you analyze today?
                </h2>

                <div className="chatx-cards">
                    <div className="chatx-card">
                    <div className="chatx-card-icon">
                        <Activity size={20} />
                    </div>
                    <div>
                        <div className="chatx-card-title">
                        Medical Imaging
                        </div>
                        <div className="chatx-card-desc">
                        Upload and analyze X-rays, MRIs, CT scans
                        </div>
                    </div>
                    </div>

                    <div className="chatx-card">
                    <div className="chatx-card-icon">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <div className="chatx-card-title">
                        Ask Questions
                        </div>
                        <div className="chatx-card-desc">
                        Get expert explanations
                        </div>
                    </div>
                    </div>
                </div>
                </div>
            ) : (
                <div className="chatx-chat-area">
                {messages.map((msg, index) => (
                    <div
                    key={index}
                    className={`chatx-chat-row ${
                        msg.role === "user"
                        ? "chatx-user"
                        : "chatx-ai"
                    }`}
                    >
                    {msg.role === "ai" && (
                        <div className="chatx-avatar">
                        <Activity size={14} />
                        </div>
                    )}

                    <div className="chatx-bubble">
                        {msg.text && <div>{msg.text}</div>}
                        {msg.files && msg.files.length > 0 && (
                            <div className="chatx-bubble-files">
                                {msg.files.map((file, i) => (
                                    <div key={i} className="chatx-bubble-file">
                                        {file.preview ? (
                                            <img
                                                src={file.preview}
                                                className="chatx-bubble-img"
                                                alt=""
                                            />
                                        ) : (
                                            <div className="chatx-bubble-file-doc">
                                                <FileText size={16} />
                                                <span>{file.name}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </div>
                ))}

                {loading && (
                    <div className="chatx-chat-row chatx-ai">
                    <div className="chatx-avatar">
                        <Activity size={14} />
                    </div>
                    <div className="chatx-bubble chatx-loading">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    </div>
                )}

                <div ref={chatEndRef} />
                </div>
            )}
            </div>

            {/* FILE BAR */}
            {files.length > 0 && (
            <div className="chatx-filebar">
                {files.map((file, index) => (
                <div key={index} className="chatx-file-item">
                    {file.preview ? (
                    <img src={file.preview} className="chatx-file-img" alt="" />
                    ) : (
                    <div className="chatx-file-icon">
                        <FileText size={18} />
                    </div>
                    )}

                    <div className="chatx-file-info">
                    <div className="chatx-file-name">{file.name}</div>
                    <div className="chatx-file-meta">{file.size}</div>
                    </div>

                    <button
                    className="chatx-close"
                    onClick={() => removeFile(index)}
                    >
                    <X size={16} />
                    </button>
                </div>
                ))}
            </div>
        )}

        {/* INPUT */}
        <div className="chatx-inputbar">
            <div className="chatx-upload-wrapper">
                <button
                className="chatx-upload-btn"
                onClick={() => setShowUpload((prev) => !prev)}
                >
                <Paperclip size={18} />
                </button>

                {/* DROPDOWN */}
                {showUpload && (
                <div className="chatx-upload-dropdown">

                <label className="chatx-upload-item">
                    <FileUp size={16} />
                    <span className="chatx-upload-text">Upload PDF</span>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,image/*,.dcm"
                        onChange={(e) => {
                            handleUpload(e);
                            setShowUpload(false);
                        }}
                        hidden
                    />
                </label>

                <label
                    className="chatx-upload-item"
                    onClick={() => {
                        window.location.href = "/orthanc";
                        setShowUpload(false);
                    }}
                    >
                    <Database size={16} />
                    <span className="chatx-upload-text">DICOM Orthanc</span>
                </label>

                </div>
                )}
            </div>

            <textarea
                className="chatx-input"
                rows={1}
                value={message}
                placeholder="Type your message..."
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                disabled={loading}
            />

            <button
                className="chatx-send-btn"
                onClick={sendMessage}
                disabled={loading}
            >
                <Send size={18} />
            </button>
            </div>
        </div>

    </div>
    );
}