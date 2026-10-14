import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Quiz
from ..services.live_quiz_manager import live_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/live", tags=["Live Quiz"])

class CreateLiveRoomRequest(BaseModel):
    quiz_id: int
    duration_seconds: Optional[int] = 25

class CreateLiveRoomResponse(BaseModel):
    pin: str
    quiz_id: int
    quiz_title: str
    total_questions: int


@router.post("/create-room", response_model=CreateLiveRoomResponse)
def create_live_quiz_room(req: CreateLiveRoomRequest, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == req.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ đề thi.")

    questions = [
        {
            "id": q.id,
            "content": q.content,
            "chapter": q.chapter,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_answer": q.correct_answer,
            "explanation_a": q.explanation_a,
            "explanation_b": q.explanation_b,
            "explanation_c": q.explanation_c,
            "explanation_d": q.explanation_d,
        }
        for q in quiz.questions
    ]

    if len(questions) == 0:
        raise HTTPException(status_code=400, detail="Bộ đề chưa có câu hỏi nào để tổ chức thi đấu.")

    quiz_data = {
        "id": quiz.id,
        "title": quiz.title,
        "questions": questions
    }

    room = live_manager.create_room(quiz_data, duration=req.duration_seconds or 25)

    return CreateLiveRoomResponse(
        pin=room.pin,
        quiz_id=room.quiz_id,
        quiz_title=room.quiz_title,
        total_questions=len(room.questions)
    )


@router.get("/room/{pin}")
def get_live_room_info(pin: str):
    room = live_manager.get_room(pin)
    if not room:
        raise HTTPException(status_code=404, detail="Phòng thi đấu không tồn tại hoặc đã kết thúc.")
    return room.get_public_lobby()


@router.websocket("/ws/host/{pin}")
async def websocket_host_endpoint(websocket: WebSocket, pin: str):
    await websocket.accept()
    room = live_manager.get_room(pin)
    if not room:
        await websocket.send_text(json.dumps({"type": "ERROR", "message": "Phòng không tồn tại."}))
        await websocket.close()
        return

    room.host_socket = websocket
    logger.info(f"Host connected to live room {pin}")

    # Send initial state to host
    await websocket.send_text(json.dumps({
        "type": "INIT_HOST",
        "data": room.get_public_lobby()
    }))

    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            action = data.get("action")

            if action == "START_QUIZ":
                await live_manager.start_quiz(room)
            elif action == "REVEAL_ANSWER":
                await live_manager.reveal_question_result(room)
            elif action == "SHOW_LEADERBOARD":
                await live_manager.show_leaderboard(room)
            elif action == "NEXT_QUESTION":
                await live_manager.next_question(room)
            elif action == "KICK_PLAYER":
                player_id = data.get("player_id")
                if player_id:
                    await live_manager.remove_player(room, player_id)

    except WebSocketDisconnect:
        logger.info(f"Host disconnected from room {pin}")
        room.host_socket = None
    except Exception as e:
        logger.warning(f"Error in host websocket {pin}: {e}")
        room.host_socket = None


@router.websocket("/ws/player/{pin}")
async def websocket_player_endpoint(
    websocket: WebSocket,
    pin: str,
    name: str = Query(...),
    avatar: str = Query("🦊"),
    player_id: str = Query(...)
):
    await websocket.accept()
    room = live_manager.get_room(pin)
    if not room:
        await websocket.send_text(json.dumps({"type": "ERROR", "message": "Phòng không tồn tại hoặc đã kết thúc."}))
        await websocket.close()
        return

    if room.state != "LOBBY":
        await websocket.send_text(json.dumps({"type": "ERROR", "message": "Trận đấu đã bắt đầu, không thể tham gia lúc này."}))
        await websocket.close()
        return

    logger.info(f"Player {name} ({player_id}) joined room {pin}")
    await live_manager.add_player(room, player_id, name, avatar, websocket)

    # Send room info to player
    await websocket.send_text(json.dumps({
        "type": "JOIN_SUCCESS",
        "data": {
            "pin": room.pin,
            "quiz_title": room.quiz_title,
            "player_id": player_id,
            "name": name,
            "avatar": avatar,
            "total_questions": len(room.questions)
        }
    }))

    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            action = data.get("action")

            if action == "SUBMIT_ANSWER":
                choice = data.get("choice", "")
                await live_manager.submit_player_answer(room, player_id, choice)

    except WebSocketDisconnect:
        logger.info(f"Player {name} disconnected from room {pin}")
        await live_manager.remove_player(room, player_id)
    except Exception as e:
        logger.warning(f"Error in player websocket {pin}: {e}")
        await live_manager.remove_player(room, player_id)
