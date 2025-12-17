let sessionId = localStorage.getItem("session_id");
if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
}

let currentImageBase64 = null;

const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const imgInput = document.getElementById('img-input');
const sendBtn = document.getElementById('send-btn');
const preview = document.getElementById('preview');

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

function appendMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerText = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function loadHistory() {
    try {
        const res = await fetch(`/history/${sessionId}`);
        const data = await res.json();

        data.history.forEach(msg => {
            appendMessage(msg.content, msg.role === "assistant" ? "model" : "user");
        });
    } catch {
        console.warn("No history found");
    }
}

window.onload = loadHistory;

function showLoading() {
    const loader = document.getElementById('loading-bubble');
    const chatBox = document.getElementById('chat-box');
    
    chatBox.appendChild(loader);
    loader.style.display = 'block';
    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideLoading() {
    const loader = document.getElementById('loading-bubble');
    if (loader) {
        loader.style.display = 'none';
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

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
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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