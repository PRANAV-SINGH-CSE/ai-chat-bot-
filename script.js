// ================= SESSION =================
let sessionId = localStorage.getItem("session_id");
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
}

// ================= CONFIG =================
const API_BASE = "https://YOUR-CLOUDFLARE-URL.trycloudflare.com";
const AUTH_TOKEN = "my-secret-key";

let currentImageBase64 = null;

// ================= DOM =================
const chatBox = document.getElementById("chat-box");
const msgInput = document.getElementById("msg-input");
const imgInput = document.getElementById("img-input");
const sendBtn = document.getElementById("send-btn");
const preview = document.getElementById("preview");

// ================= IMAGE =================
imgInput.addEventListener("change", () => {
    const file = imgInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        currentImageBase64 = e.target.result;
        preview.src = currentImageBase64;
        preview.style.display = "block";
    };
    reader.readAsDataURL(file);
});

// ================= UI =================
function appendMessage(text, sender) {
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ================= LOAD HISTORY =================
async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/history/${sessionId}`, {
            headers: { "X-Auth": AUTH_TOKEN }
        });

        if (!res.ok) return;

        const data = await res.json();
        chatBox.innerHTML = "";

        data.history.forEach(msg => {
            appendMessage(
                msg.content,
                msg.role === "assistant" ? "model" : "user"
            );
        });
    } catch {
        console.warn("History load failed");
    }
}

window.onload = loadHistory;

// ================= SEND =================
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text && !currentImageBase64) return;

    appendMessage(text + (currentImageBase64 ? " [Image]" : ""), "user");
    msgInput.value = "";
    preview.style.display = "none";
    sendBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth": AUTH_TOKEN
            },
            body: JSON.stringify({
                session_id: sessionId,
                message: text,
                image_base64: currentImageBase64
            })
        });

        if (!res.ok) throw new Error("Server error");

        const data = await res.json();
        appendMessage(data.response, "model");
    } catch (err) {
        appendMessage("Server error", "model");
        console.error(err);
    } finally {
        currentImageBase64 = null;
        imgInput.value = "";
        sendBtn.disabled = false;
        msgInput.focus();
    }
}

// ================= ENTER KEY =================
function handleEnter(e) {
    if (e.key === "Enter") sendMessage();
}
