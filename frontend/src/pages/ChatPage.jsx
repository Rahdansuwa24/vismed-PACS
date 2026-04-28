import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

export default function ChatPage() {
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
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
    if (!message.trim()) return;

    const userPrompt = message;
    const userMsg = {
        role: "user",
        text: userPrompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");

    setTimeout(() => {
        const textarea = document.querySelector(".chatx-input");
        if (textarea) textarea.style.height = "42px";
    }, 0);

    try {
        const response = await axios.get("/ai/chatbot", {
        params: {
            prompt: userPrompt,
        },
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
            "Gagal menghubungi AI. Pastikan backend dan Ollama aktif.",
        };

        setMessages((prev) => [...prev, aiMsg]);
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
    }, [messages]);

    return (
        <div className="chatx-root">
        <header className="chatx-header">
            <div className="chatx-logo-area">
            <img src={logo} className="chatx-logo-img" alt="logo" />
            <span className="chatx-logo-text">PACS Ai</span>
            </div>
            <div className="chatx-status">● Online</div>
        </header>

        <div className="chatx-content">
            {messages.length === 0 && (
            <>
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

                <div className="chatx-message">
                <div className="chatx-avatar">
                    <Activity size={14} />
                </div>
                <div className="chatx-bubble">
                    Upload your radiology images and I will analyze them.
                </div>
                </div>
            </>
            )}

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
                    {msg.text}
                </div>
                </div>
            ))}

            <div ref={chatEndRef} />
            </div>
        </div>

        {files.length > 0 && (
            <div className="chatx-filebar">
            {files.map((file, index) => (
                <div key={index} className="chatx-file-item">
                {file.preview ? (
                    <img src={file.preview} className="chatx-file-img" />
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
        
        <div className="chatx-inputbar">
            <label className="chatx-upload-btn">
            <Paperclip size={18} />
            <input type="file" multiple hidden onChange={handleUpload} />
            </label>

            <textarea
            className="chatx-input"
            rows={1}
            value={message}
            placeholder="Type your message..."
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            />

            <button className="chatx-send-btn" onClick={sendMessage}>
            <Send size={18} />
            </button>
        </div>
        </div>
    );
}
