import uuid
from datetime import datetime, timezone
from typing import Optional

try:
    import pymongo
    from pymongo.errors import DuplicateKeyError
except Exception:  # pragma: no cover - optional in some deployment environments
    pymongo = None
    DuplicateKeyError = ValueError

from backend.security.password import hash_password
from backend.services.db import users_col


def _doc_to_user(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    return {
        "id": doc["id"],
        "email": doc["email"],
        "created_at": doc["created_at"],
    }


def create_user(email: str, password: str) -> dict:
    salt = uuid.uuid4().hex
    password_hash = hash_password(password, salt)
    user_id = uuid.uuid4().hex
    created_at = datetime.now(timezone.utc).isoformat()
    email_clean = email.lower().strip()

    try:
        users_col.insert_one({
            "id": user_id,
            "email": email_clean,
            "password_hash": password_hash,
            "salt": salt,
            "created_at": created_at,
        })
    except DuplicateKeyError as exc:
        raise ValueError("A user with that email already exists") from exc

    return {"id": user_id, "email": email_clean, "created_at": created_at}


def get_user_by_email(email: str) -> Optional[dict]:
    doc = users_col.find_one({"email": email.lower().strip()})
    return _doc_to_user(doc)


def get_user_by_id(user_id: str) -> Optional[dict]:
    doc = users_col.find_one({"id": user_id})
    return _doc_to_user(doc)


def authenticate_user(email: str, password: str) -> Optional[dict]:
    doc = users_col.find_one({"email": email.lower().strip()})
    if not doc:
        return None

    salt = doc["salt"]
    password_hash = doc["password_hash"]
    if hash_password(password, salt) != password_hash:
        return None

    return _doc_to_user(doc)
