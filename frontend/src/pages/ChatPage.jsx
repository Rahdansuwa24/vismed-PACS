import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import "../styles/chat.css";
import logo from "../assets/vismed-logo.png";

import {
    Activity,
    Sparkles,
    Paperclip,
    Send,
    X,
    FileText,
    FileUp,
    Database, 
} from "lucide-react";

export default function ChatPage() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showUpload, setShowUpload] = useState(false);
    const [loading, setLoading] = useState(false);

    const chatEndRef = useRef(null);

    const handleUpload = (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    const mappedFiles = selectedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            preview: isImage ? URL.createObjectURL(file) : null,
        };
    });

    setFiles((prev) => [...prev, ...mappedFiles]);
    };

    const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleInput = (e) => {
    const textarea = e.target;
    setMessage(textarea.value);

    textarea.style.height = "auto";
    const maxHeight = 120;
    textarea.style.height =
        Math.min(textarea.scrollHeight, maxHeight) + "px";
    };

    const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userPrompt = message;

    const userMsg = {
        role: "user",
        text: userPrompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setLoading(true);

    setTimeout(() => {
        const textarea = document.querySelector(".chatx-input");
        if (textarea) textarea.style.height = "42px";
    }, 0);

    try {
        const response = await axios.get("/ai/chatbot", {
        params: { prompt: userPrompt },
        });

        const aiMsg = {
        role: "ai",
        text: response.data.response || "Tidak ada response dari AI.",
        };

        setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
        const aiMsg = {
        role: "ai",
        text:
            err.response?.data?.error ||
            "Gagal menghubungi AI. Pastikan backend aktif.",
        };

        setMessages((prev) => [...prev, aiMsg]);
    } finally {
        setLoading(false);
    }
    };

    const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    };

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

    return (
    <div className="chatx-root">
      {/* SIDEBAR */}
        <aside className="chatx-sidebar">
            <button
            className="chatx-newchat"
            onClick={() => setMessages([])}
            >
            + New Chat
            </button>

            <div className="chatx-history">
            {messages.map((msg, i) => (
                <div key={i} className="chatx-history-item">
                {msg.text.slice(0, 30)}
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

                    <div className="chatx-bubble">{msg.text}</div>
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

                <label
                    className="chatx-upload-item"
                    onClick={() => {
                        document.getElementById("fileInput").click();
                    }}
                    >
                    <FileUp size={16} />
                    <span className="chatx-upload-text">Upload PDF</span>

                    <input
                        id="fileInput"
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