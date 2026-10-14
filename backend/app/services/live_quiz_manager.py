import asyncio
import json
import logging
import random
import time
from typing import Dict, List, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class LiveQuizRoom:
    def __init__(self, pin: str, quiz_data: dict, question_duration: int = 25):
        self.pin = pin
        self.quiz_id = quiz_data.get("id")
        self.quiz_title = quiz_data.get("title", "Đấu Trường Trắc Nghiệm")
        self.questions = quiz_data.get("questions", [])
        self.question_duration = question_duration  # seconds per question

        self.host_socket: Optional[WebSocket] = None
        self.players: Dict[str, dict] = {}  # player_id -> { id, name, avatar, score, socket, streak }
        self.state: str = "LOBBY"  # LOBBY, QUESTION, REVEAL, LEADERBOARD, FINISHED
        self.current_q_index: int = 0
        self.q_start_time: float = 0.0
        self.current_answers: Dict[str, dict] = {}  # player_id -> { choice, score_earned, is_correct, time_taken }
        self.created_at = time.time()

    def get_public_lobby(self) -> dict:
        return {
            "pin": self.pin,
            "quiz_title": self.quiz_title,
            "total_questions": len(self.questions),
            "state": self.state,
            "players": [
                {"id": p["id"], "name": p["name"], "avatar": p["avatar"], "score": p["score"]}
                for p in self.players.values()
            ],
            "player_count": len(self.players)
        }

    def get_current_question_public(self) -> Optional[dict]:
        if 0 <= self.current_q_index < len(self.questions):
            q = self.questions[self.current_q_index]
            return {
                "index": self.current_q_index,
                "total": len(self.questions),
                "content": q.get("content", ""),
                "option_a": q.get("option_a", ""),
                "option_b": q.get("option_b", ""),
                "option_c": q.get("option_c", ""),
                "option_d": q.get("option_d", ""),
                "duration": self.question_duration,
                "chapter": q.get("chapter", "")
            }
        return None

    def get_reveal_data(self) -> dict:
        q = self.questions[self.current_q_index] if 0 <= self.current_q_index < len(self.questions) else {}
        correct = (q.get("correct_answer") or "A").upper()

        # Count choices
        stats = {"A": 0, "B": 0, "C": 0, "D": 0}
        for ans in self.current_answers.values():
            c = ans.get("choice", "").upper()
            if c in stats:
                stats[c] += 1

        return {
            "index": self.current_q_index,
            "correct_answer": correct,
            "stats": stats,
            "total_answers": len(self.current_answers),
            "explanation_a": q.get("explanation_a"),
            "explanation_b": q.get("explanation_b"),
            "explanation_c": q.get("explanation_c"),
            "explanation_d": q.get("explanation_d"),
        }

    def get_leaderboard(self, top_n: int = 10) -> List[dict]:
        sorted_players = sorted(
            self.players.values(),
            key=lambda x: x["score"],
            reverse=True
        )
        return [
            {
                "rank": i + 1,
                "id": p["id"],
                "name": p["name"],
                "avatar": p["avatar"],
                "score": p["score"],
                "streak": p.get("streak", 0)
            }
            for i, p in enumerate(sorted_players[:top_n])
        ]


class LiveQuizManager:
    def __init__(self):
        self.rooms: Dict[str, LiveQuizRoom] = {}

    def generate_pin(self) -> str:
        for _ in range(100):
            pin = f"{random.randint(100000, 999999)}"
            if pin not in self.rooms:
                return pin
        return f"{int(time.time()) % 1000000:06d}"

    def create_room(self, quiz_data: dict, duration: int = 25) -> LiveQuizRoom:
        pin = self.generate_pin()
        room = LiveQuizRoom(pin, quiz_data, question_duration=duration)
        self.rooms[pin] = room
        logger.info(f"Created Live Quiz Room {pin} for '{quiz_data.get('title')}'")
        return room

    def get_room(self, pin: str) -> Optional[LiveQuizRoom]:
        return self.rooms.get(pin)

    async def broadcast(self, room: LiveQuizRoom, message: dict):
        dead_sockets = []
        payload = json.dumps(message)

        # Send to host
        if room.host_socket:
            try:
                await room.host_socket.send_text(payload)
            except Exception:
                dead_sockets.append(("host", None, room.host_socket))

        # Send to all players
        for p_id, p in list(room.players.items()):
            ws = p.get("socket")
            if ws:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_sockets.append(("player", p_id, ws))

        # Cleanup disconnected sockets
        for role, p_id, ws in dead_sockets:
            if role == "host":
                room.host_socket = None
            elif p_id in room.players:
                del room.players[p_id]

    async def broadcast_player_list(self, room: LiveQuizRoom):
        await self.broadcast(room, {
            "type": "PLAYER_LIST_UPDATE",
            "data": room.get_public_lobby()
        })

    async def add_player(self, room: LiveQuizRoom, player_id: str, name: str, avatar: str, ws: WebSocket):
        room.players[player_id] = {
            "id": player_id,
            "name": name,
            "avatar": avatar,
            "score": 0,
            "socket": ws,
            "streak": 0
        }
        await self.broadcast_player_list(room)

    async def remove_player(self, room: LiveQuizRoom, player_id: str):
        if player_id in room.players:
            del room.players[player_id]
            await self.broadcast_player_list(room)

    async def start_quiz(self, room: LiveQuizRoom):
        room.state = "QUESTION"
        room.current_q_index = 0
        room.q_start_time = time.time()
        room.current_answers = {}

        q_data = room.get_current_question_public()
        await self.broadcast(room, {
            "type": "QUESTION_START",
            "data": q_data
        })

    async def submit_player_answer(self, room: LiveQuizRoom, player_id: str, choice: str):
        if room.state != "QUESTION" or player_id not in room.players:
            return

        if player_id in room.current_answers:
            return  # already answered this question

        elapsed = max(0.1, time.time() - room.q_start_time)
        q = room.questions[room.current_q_index]
        correct = (q.get("correct_answer") or "A").upper()
        is_corr = (choice.upper() == correct)

        # Speed score calculation (Kahoot style: 1000 max base)
        score_earned = 0
        if is_corr:
            ratio = max(0.0, 1.0 - (elapsed / room.question_duration))
            # 500 base + 500 speed bonus
            score_earned = int(500 + 500 * ratio)
            room.players[player_id]["score"] += score_earned
            room.players[player_id]["streak"] = room.players[player_id].get("streak", 0) + 1
        else:
            room.players[player_id]["streak"] = 0

        room.current_answers[player_id] = {
            "choice": choice.upper(),
            "score_earned": score_earned,
            "is_correct": is_corr,
            "time_taken": round(elapsed, 2)
        }

        # Send individual feedback to player
        player_ws = room.players[player_id].get("socket")
        if player_ws:
            try:
                await player_ws.send_text(json.dumps({
                    "type": "ANSWER_RECEIVED",
                    "data": {
                        "choice": choice.upper(),
                        "score_earned": score_earned,
                        "is_correct": is_corr,
                        "streak": room.players[player_id]["streak"],
                        "total_score": room.players[player_id]["score"]
                    }
                }))
            except Exception:
                pass

        # Broadcast update of answered count to host
        if room.host_socket:
            try:
                await room.host_socket.send_text(json.dumps({
                    "type": "ANSWER_COUNT_UPDATE",
                    "data": {
                        "answered_count": len(room.current_answers),
                        "total_players": len(room.players)
                    }
                }))
            except Exception:
                pass

    async def reveal_question_result(self, room: LiveQuizRoom):
        room.state = "REVEAL"
        reveal_data = room.get_reveal_data()
        await self.broadcast(room, {
            "type": "QUESTION_REVEAL",
            "data": reveal_data
        })

    async def show_leaderboard(self, room: LiveQuizRoom):
        room.state = "LEADERBOARD"
        lb = room.get_leaderboard(top_n=10)
        await self.broadcast(room, {
            "type": "LEADERBOARD_UPDATE",
            "data": {
                "leaderboard": lb,
                "current_question": room.current_q_index + 1,
                "total_questions": len(room.questions),
                "is_last_question": (room.current_q_index + 1 >= len(room.questions))
            }
        })

    async def next_question(self, room: LiveQuizRoom):
        if room.current_q_index + 1 >= len(room.questions):
            room.state = "FINISHED"
            lb = room.get_leaderboard(top_n=10)
            await self.broadcast(room, {
                "type": "QUIZ_FINISHED",
                "data": {
                    "podium": lb[:3],
                    "leaderboard": lb
                }
            })
        else:
            room.current_q_index += 1
            room.state = "QUESTION"
            room.q_start_time = time.time()
            room.current_answers = {}
            q_data = room.get_current_question_public()
            await self.broadcast(room, {
                "type": "QUESTION_START",
                "data": q_data
            })

    def cleanup_old_rooms(self, max_age_seconds: int = 7200):
        now = time.time()
        to_del = [pin for pin, r in self.rooms.items() if now - r.created_at > max_age_seconds]
        for pin in to_del:
            del self.rooms[pin]


# Singleton instance
live_manager = LiveQuizManager()
