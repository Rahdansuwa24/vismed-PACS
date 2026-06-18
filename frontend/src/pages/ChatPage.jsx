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
    Stethoscope,
} from "lucide-react";

import "../styles/chat.css";
import logo from "../assets/vismed-logo.png";

const suggestionTemplates = [
    { label: "Analisis dengan ID", text: "analisis hasil pemeriksaan dengan orthancStudyId " },
    { label: "Analisis dengan Nama", text: "analisis hasil pemeriksaan dengan nama pasien " },
    { label: "Buka OHIF Viewer", text: "tampilkan link viewer untuk pasien " },
    { label: "Cari Rekam Medis", text: "cari rekam medis pasien " }
];

export default function ChatPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState("");
    const [showUpload, setShowUpload] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState("");

    // State untuk history sidebar
    const [chats, setChats] = useState(() => {
        const saved = localStorage.getItem("chat_history");
        return saved ? JSON.parse(saved) : [];
    });
    const [activeChatId, setActiveChatId] = useState(() => {
        const saved = localStorage.getItem("chat_history");
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.length > 0 ? parsed[0].id : null;
        }
        return null;
    });
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem("chat_history");
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.length > 0 ? parsed[0].messages : [];
        }
        return [];
    });

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
                isImage,
            };
        });

        setFiles((prev) => [...prev, ...mappedFiles]);
        setSelectedDomain("");
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
            let response;
            if (currentFiles.length > 0) {
                const formData = new FormData();
                formData.append("prompt", userPrompt + (fileNames ? ` [FILES: ${fileNames}]` : ""));
                if (selectedDomain) formData.append("domain", selectedDomain);
                currentFiles.forEach((file) => {
                    formData.append("files", file.raw);
                });
                response = await axios.post("/ai/chatbot", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
            } else {
                const history = messages.slice(-6).map(m => ({
                    role: m.role === "user" ? "user" : "assistant",
                    content: m.text || "",
                }));
                response = await axios.post("/ai/chatbot", {
                    prompt: userPrompt,
                    history,
                });
            }

            const aiMsg = {
                role: "ai",
                text: response.data.response || "Tidak ada response dari AI.",
                candidates: response.data.candidates || null,
                disambiguationRequired: response.data.disambiguationRequired || false,
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
            setSelectedDomain("");

        } catch (err) {
            console.error("AI ERROR:", err);
            const aiMsg = {
                role: "ai",
                text:
                    err.response?.data?.error ||
                    "Layanan AI sedang tidak tersedia. Silakan coba lagi nanti.",
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

    const renderInlineText = (text, keyPrefix) => {
        const parts = String(text).split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);

        return parts.map((part, index) => {
            if (/^https?:\/\//i.test(part)) {
                const match = part.match(/^(.*?)([).,;!?]+)?$/);
                const href = match?.[1] || part;
                const trailing = match?.[2] || "";

                return (
                    <span key={`${keyPrefix}-url-${index}`}>
                        <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="chatx-link"
                        >
                            {href}
                        </a>
                        {trailing}
                    </span>
                );
            }

            if (/^\*\*[^*]+\*\*$/.test(part)) {
                return (
                    <strong key={`${keyPrefix}-bold-${index}`}>
                        {part.slice(2, -2)}
                    </strong>
                );
            }

            return part;
        });
    };

    const renderMessageText = (text) => {
        return String(text)
            .split("\n")
            .map((line, index) => {
                const cleanLine = line.replace(/^\s*[*-]\s+/, "");

                // Hide raw [STUDY_CANDIDATE:...] tags — rendered as buttons instead
                if (/^\[STUDY_CANDIDATE:[A-Fa-f0-9-]+\]$/.test(cleanLine.trim())) {
                    return null;
                }

                if (!cleanLine.trim()) {
                    return <br key={`line-${index}`} />;
                }

                return (
                    <div key={`line-${index}`}>
                        {renderInlineText(cleanLine, `line-${index}`)}
                    </div>
                );
            })
            .filter(Boolean);
    };

    // Handle clicking a study candidate button
    const handleSelectCandidate = async (candidate) => {
        const studyPrompt = `analisis hasil pemeriksaan dengan orthancStudyId ${candidate.orthancStudyId}`;
        const chatId = activeChatId;
        if (!chatId) return;

        const userMsg = { role: "user", text: studyPrompt, files: [] };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setLoading(true);

        try {
            const history = messages.slice(-6).map(m => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text || "",
            }));
            const response = await axios.post("/ai/chatbot", { prompt: studyPrompt, history });
            const aiMsg = {
                role: "ai",
                text: response.data.response || "Tidak ada response dari AI.",
                candidates: response.data.candidates || null,
                disambiguationRequired: response.data.disambiguationRequired || false,
            };
            setMessages((prev) => {
                const updated = [...prev, aiMsg];
                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId ? { ...chat, messages: updated } : chat
                    )
                );
                return updated;
            });
        } catch (err) {
            const aiMsg = {
                role: "ai",
                text: err.response?.data?.error || "Layanan AI sedang tidak tersedia.",
            };
            setMessages((prev) => {
                const updated = [...prev, aiMsg];
                setChats((prevChats) =>
                    prevChats.map((chat) =>
                        chat.id === chatId ? { ...chat, messages: updated } : chat
                    )
                );
                return updated;
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestionClick = (text) => {
        setMessage(text);
        const textarea = document.querySelector(".chatx-input");
        if (textarea) {
            textarea.focus();
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = text.length;
            }, 0);
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

    // Load chat from localStorage is now handled directly in state initialization

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
                            className={`chatx-history-item ${chat.id === activeChatId ? "active" : ""
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
                                    className={`chatx-chat-row ${msg.role === "user"
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
                                        {msg.text && (
                                            <div className="chatx-message-text">
                                                {renderMessageText(msg.text)}
                                            </div>
                                        )}
                                        {/* Interactive study candidate buttons */}
                                        {msg.disambiguationRequired && Array.isArray(msg.candidates) && msg.candidates.length > 0 && (
                                            <div className="chatx-candidates">
                                                {(msg.expanded ? msg.candidates : msg.candidates.slice(0, 3)).map((c, ci) => (
                                                    <button
                                                        key={ci}
                                                        className="chatx-candidate-btn"
                                                        onClick={() => handleSelectCandidate(c)}
                                                        disabled={loading}
                                                    >
                                                        <Stethoscope size={14} />
                                                        <span>
                                                            <strong>{c.studyDescription || c.modality || "Studi"}</strong>
                                                            <br />
                                                            {c.studyDate
                                                                ? new Date(c.studyDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
                                                                : "-"}
                                                            {c.modality ? ` · ${c.modality}` : ""}
                                                            {c.seriesCount ? ` · ${c.seriesCount} seri` : ""}
                                                        </span>
                                                    </button>
                                                ))}
                                                {msg.candidates.length > 3 && (
                                                    <button
                                                        className="chatx-showmore-btn"
                                                        onClick={() => {
                                                            msg.expanded = !msg.expanded;
                                                            setMessages([...messages]);
                                                        }}
                                                    >
                                                        {msg.expanded ? "Tampilkan Lebih Sedikit" : `Tampilkan Lebih Banyak (${msg.candidates.length - 3} lagi)`}
                                                    </button>
                                                )}
                                            </div>
                                        )}
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

                {/* FILE BAR + DOMAIN SELECTOR */}
                {files.length > 0 && (
                    <div className="chatx-filebar">
                        {files.some(f => f.isImage) && (
                            <div className="chatx-domain-row">
                                <label className="chatx-domain-label">Jenis citra:</label>
                                <select
                                    className="chatx-domain-select"
                                    value={selectedDomain}
                                    onChange={e => setSelectedDomain(e.target.value)}
                                >
                                    <option value="">Auto-detect dari teks</option>
                                    <option value="xray">X-Ray Dada / Thorax</option>
                                    <option value="ct_chest">CT Scan Dada (CT Chest)</option>
                                    <option value="ct_brain">CT Scan Otak (CT Brain)</option>
                                    <option value="ecg">EKG / ECG</option>
                                    <option value="endoscopy">Endoskopi</option>
                                </select>
                            </div>
                        )}
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

                {/* SUGGESTION TEMPLATES */}
                <div className="chatx-suggestions">
                    {suggestionTemplates.map((template, idx) => (
                        <button
                            key={idx}
                            className="chatx-suggestion-chip"
                            onClick={() => handleSuggestionClick(template.text)}
                            disabled={loading}
                        >
                            {template.label}
                        </button>
                    ))}
                </div>

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
                                    <span className="chatx-upload-text">Upload DICOM, PDF, Image</span>

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
