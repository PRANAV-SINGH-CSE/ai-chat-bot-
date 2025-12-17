// -------- SESSION PERSISTENCE --------
let sessionId = localStorage.getItem("session_id");
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
}

// -------- CONFIG (IMPORTANT) --------
// 🔴 REPLACE THIS WITH YOUR CLOUDFLARE / NGROK URL
const API_BASE = "https://YOUR-TUNNEL-URL.trycloudflare.com";

// 🔐 SIMPLE AUTH (MUST MATCH BACKEND)
const AUTH_TOKEN = "my-secret-key";

let currentImageBase64 = null;

// -------- DOM --------
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const imgInput = document.getElementById('img-input');
const sendBtn = document.getElementById('send-btn');
const preview = document.getElementById('preview');

// -------- IMAGE UPLOAD --------
imgInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        currentImageBase64 = e.target.result;
        preview.src = currentImageBase64;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

// -------- UI HELPERS --------
function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showLoading() {
    const loader = document.getElementById('loading-bubble');
    loader.style.display = 'block';
    chatBox.appendChild(loader);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideLoading() {
    const loader = document.getElementById('loading-bubble');
    loader.style.display = 'none';
}

// -------- LOAD HISTORY --------
async function loadHistory() {
    chatBox.innerHTML = ""; // 🔥 PREVENT DUPLICATES

    try {
        const res = await fetch(`${API_BASE}/history/${sessionId}`, {
            headers: {
                "X-Auth": AUTH_TOKEN
            }
        });

        if (!res.ok) return;

        const data = await res.json();

        data.history.forEach(msg => {
            appendMessage(
                msg.content,
                msg.role === "assistant" ? "model" : "user"
            );
        });
    } catch (err) {
        console.warn("No history loaded");
    }
}

window.onload = loadHistory;

// -------- ENTER KEY --------
function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// -------- SEND MESSAGE --------
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text && !currentImageBase64) return;

    appendMessage(text + (currentImageBase64 ? " [Image]" : ""), "user");

    msgInput.value = "";
    preview.style.display = "none";
    sendBtn.disabled = true;
    showLoading();

    const payload = {
        session_id: sessionId,
        message: text,
        image_base64: currentImageBase64
    };

    try {
        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth": AUTH_TOKEN
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        hideLoading();
        appendMessage(data.response, "model");

    } catch (error) {
        hideLoading();
        appendMessage("Server error", "model");
        console.error("Chat Error:", error);
    } finally {
        currentImageBase64 = null;
        imgInput.value = "";
        sendBtn.disabled = false;
        msgInput.focus();
    }
}
