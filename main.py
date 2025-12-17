import uvicorn
import base64
from fastapi import FastAPI, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import ollama

# ---------------- CONFIG ----------------
MAX_HISTORY = 10
MAX_IMAGE_SIZE = 5 * 1024 * 1024
AUTH_TOKEN = "my-secret-key"  # MUST MATCH script.js

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are Pranav's personal AI assistant. "
        "Sound human, friendly, and natural. "
        "Avoid robotic phrases. "
        "Adapt tone based on user behavior."
    )
}

# ---------------- APP ----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # OK for tunnel + personal use
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------- MEMORY ----------------
sessions: Dict[str, List[Dict[str, Any]]] = {}

# ---------------- SCHEMA ----------------
class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = ""
    image_base64: Optional[str] = None

# ---------------- HELPERS ----------------
def check_auth(x_auth: str):
    if x_auth != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

def get_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = [SYSTEM_PROMPT]
    return sessions[session_id]

def decode_image(image_base64: str) -> bytes:
    header, encoded = image_base64.split(",", 1)
    image_bytes = base64.b64decode(encoded)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(413, "Image too large")
    return image_bytes

# ---------------- ENDPOINTS ----------------
@app.post("/chat")
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    history = get_session(req.session_id)

    user_msg = {
        "role": "user",
        "content": req.message or "Analyze the image."
    }

    has_image = False

    if req.image_base64:
        user_msg["images"] = [decode_image(req.image_base64)]
        has_image = True

    history.append(user_msg)
    history[:] = history[-MAX_HISTORY:]

    try:
        response = ollama.chat(
            model="llava" if has_image else "llama3",
            messages=history
        )
        reply = response["message"]["content"]
    except Exception as e:
        print("Ollama error:", e)
        raise HTTPException(500, "Model failed")

    history.append({"role": "assistant", "content": reply})
    history[:] = history[-MAX_HISTORY:]

    if "images" in user_msg:
        del user_msg["images"]
        user_msg["content"] += " [Image]"

    return {"response": reply}


@app.get("/history/{session_id}")
async def get_history(
    session_id: str,
    x_auth: str = Header(None)
):
    check_auth(x_auth)

    if session_id not in sessions:
        return {"history": []}

    return {
        "history": [
            msg for msg in sessions[session_id]
            if msg["role"] != "system"
        ]
    }

# ---------------- RUN ----------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
