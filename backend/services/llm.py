import json
from datetime import datetime, timezone

from groq import Groq

from config import settings


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class LLMService:
    def __init__(self) -> None:
        self._client = Groq(api_key=settings.GROQ_API_KEY)
        print(f"[{_ts()}] [llm] Groq client initialized with model={settings.GROQ_MODEL}")

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> str:
        try:
            response = self._client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=30,
            )
            content = response.choices[0].message.content or ""
            return content
        except Exception as e:
            print(f"[{_ts()}] [llm] Error calling Groq API: {e}")
            raise

    def chat_json(
        self,
        messages: list[dict],
        temperature: float = 0.0,
        max_tokens: int = 1024,
    ) -> dict:
        raw = self.chat(messages=messages, temperature=temperature, max_tokens=max_tokens)
        try:
            # Strip markdown code fences if present
            text = raw.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                # Remove first and last fence lines
                inner = lines[1:-1] if lines[-1].startswith("```") else lines[1:]
                text = "\n".join(inner)
            return json.loads(text)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"[{_ts()}] [llm] Failed to parse JSON response: {e}\nRaw: {raw[:200]}")
            raise ValueError(f"LLM did not return valid JSON: {e}") from e


llm_service = LLMService()
