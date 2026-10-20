import uvicorn

from app.core.limits import MAX_MESSAGE_SIZE

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        env_file=".env",
        host="127.0.0.1",
        port=8000,
        workers=1,
        ws_max_size=MAX_MESSAGE_SIZE,
    )
