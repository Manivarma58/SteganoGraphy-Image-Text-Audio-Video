import os

try:
    import gridfs
    import pymongo
    from bson.objectid import ObjectId
except Exception:  # pragma: no cover - depends on deployment environment
    gridfs = None
    pymongo = None
    ObjectId = None

from backend.services.config import settings

# MongoDB connection configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "stego_vault")

if pymongo is not None:
    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users_col = db["users"]
    jobs_col = db["jobs"]
    fs = gridfs.GridFS(db)
else:
    client = None
    db = None
    users_col = None
    jobs_col = None
    fs = None

# Indexes will be initialized in initialize_database() to prevent startup/import crashes


def save_file(data: bytes, filename: str) -> str:
    """Saves binary data to GridFS and returns the ObjectId string prefixed with gridfs://."""
    file_id = fs.put(data, filename=filename)
    return f"gridfs://{file_id}"


def get_file_bytes(path_or_id: str) -> bytes:
    """Retrieves binary data from GridFS if starting with gridfs://, otherwise reads from local file path."""
    if path_or_id.startswith("gridfs://"):
        file_id_str = path_or_id.replace("gridfs://", "")
        grid_out = fs.get(ObjectId(file_id_str))
        return grid_out.read()
    else:
        from pathlib import Path
        return Path(path_or_id).read_bytes()


def delete_file(path_or_id: str) -> None:
    """Deletes file from GridFS if starting with gridfs://, otherwise deletes from local filesystem."""
    if not path_or_id:
        return
    if path_or_id.startswith("gridfs://"):
        try:
            file_id_str = path_or_id.replace("gridfs://", "")
            fs.delete(ObjectId(file_id_str))
        except Exception:
            pass
    else:
        import os
        if os.path.exists(path_or_id):
            try:
                os.remove(path_or_id)
            except OSError:
                pass


def initialize_database() -> None:
    """Initialize indexes on the collection."""
    try:
        # 1. Clean up duplicate default user IDs if any exist
        default_id = "default_user_sachin9666"
        default_docs = list(users_col.find({"id": default_id}))
        if len(default_docs) > 1:
            print(f"Cleaning up {len(default_docs) - 1} duplicate default user records...")
            keep_id = default_docs[0]["_id"]
            users_col.delete_many({"id": default_id, "_id": {"$ne": keep_id}})

        # 2. Clean up duplicate emails (group by email and delete duplicates to allow unique index creation)
        pipeline = [
            {"$group": {"_id": "$email", "count": {"$sum": 1}, "ids": {"$push": "$_id"}}},
            {"$match": {"count": {"$gt": 1}}}
        ]
        duplicates = list(users_col.aggregate(pipeline))
        for dup in duplicates:
            email = dup["_id"]
            if email:
                print(f"Cleaning up duplicate entries for email: {email}")
                keep_id = dup["ids"][0]
                users_col.delete_many({"email": email, "_id": {"$ne": keep_id}})

        # 3. Create unique indexes
        users_col.create_index("id", unique=True)
        users_col.create_index("email", unique=True)
        jobs_col.create_index("job_id", unique=True)
        jobs_col.create_index("user_id")

        # 4. Ensure default user exists
        default_email = "sachin9666@example.com"
        doc = users_col.find_one({"id": default_id})
        if not doc:
            from datetime import datetime, timezone
            from backend.security.password import hash_password
            salt = "default_salt"
            password_hash = hash_password("password123", salt)
            users_col.insert_one({
                "id": default_id,
                "email": default_email,
                "password_hash": password_hash,
                "salt": salt,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            print("Default user created successfully.")

        print("Database indexes initialized successfully.")
    except Exception as e:
        print(f"Warning: Could not initialize database indexes: {e}")
