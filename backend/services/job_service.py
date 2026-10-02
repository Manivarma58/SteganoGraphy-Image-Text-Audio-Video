import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from backend.security.crypto import (
    build_key_binding,
    decrypt_secret,
    derive_file_signature,
    encrypt_secret,
    generate_access_key,
    sha256_hex,
)
from backend.services.config import settings
from backend.services.db import jobs_col, save_file, get_file_bytes
from backend.services.job_models import JobRecord
from backend.services.media_packaging import build_container, split_container, stego_output_name
from backend.services.model_runtime import get_runtime_profile
from backend.services.queue_manager import queue_manager
from backend.services.storage import build_storage_path
from backend.services.validation import ValidatedUpload
from backend.services.quality_enhancement import enhance_media

jobs: dict[str, JobRecord] = {}
model_service = None


def _get_model_service():
    global model_service
    if model_service is None:
        from backend.ml_models.inference import MultiModalInferenceService

        model_service = MultiModalInferenceService()
    return model_service


def get_job(job_id: str) -> JobRecord | None:
    record = jobs.get(job_id)
    if record:
        return record

    row = jobs_col.find_one({"job_id": job_id})
    if not row:
        return None

    # Safe parsing of dict/json fields
    metadata = row.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    elif metadata is None:
        metadata = {}

    device_info = row.get("device_info")
    if isinstance(device_info, str):
        try:
            device_info = json.loads(device_info)
        except Exception:
            device_info = None

    record = JobRecord(
        job_id=row["job_id"],
        job_type=row.get("job_type"),
        modality=row.get("modality"),
        user_id=row["user_id"],
        status=row.get("status"),
        progress=row.get("progress"),
        stage=row.get("stage"),
        message=row.get("message"),
        input_path=row.get("input_path"),
        secret_path=row.get("secret_path"),
        output_path=row.get("output_path"),
        output_name=row.get("output_name"),
        access_key=row.get("access_key"),
        integrity_hash=row.get("integrity_hash"),
        device_info=device_info,
        metadata=metadata,
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    jobs[job_id] = record
    return record


def get_user_job_records(user_id: str) -> list[JobRecord]:
    rows = jobs_col.find({"user_id": user_id}).sort("updated_at", -1)
    records: list[JobRecord] = []
    for row in rows:
        metadata = row.get("metadata")
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}
        elif metadata is None:
            metadata = {}

        device_info = row.get("device_info")
        if isinstance(device_info, str):
            try:
                device_info = json.loads(device_info)
            except Exception:
                device_info = None

        records.append(
            JobRecord(
                job_id=row["job_id"],
                job_type=row.get("job_type"),
                modality=row.get("modality"),
                user_id=row["user_id"],
                status=row.get("status"),
                progress=row.get("progress"),
                stage=row.get("stage"),
                message=row.get("message"),
                input_path=row.get("input_path"),
                secret_path=row.get("secret_path"),
                output_path=row.get("output_path"),
                output_name=row.get("output_name"),
                access_key=row.get("access_key"),
                integrity_hash=row.get("integrity_hash"),
                device_info=device_info,
                metadata=metadata,
                created_at=row.get("created_at"),
                updated_at=row.get("updated_at"),
            )
        )
    return records


async def _save_upload(upload: UploadFile) -> bytes:
    content = await upload.read()
    await upload.seek(0)
    return content


def _persist_job_record(record: JobRecord) -> None:
    now = datetime.now(timezone.utc).isoformat()
    if record.created_at is None:
        record.created_at = now
    record.updated_at = now

    jobs_col.update_one(
        {"job_id": record.job_id},
        {"$set": {
            "job_id": record.job_id,
            "user_id": record.user_id,
            "job_type": record.job_type,
            "modality": record.modality,
            "status": record.status,
            "progress": record.progress,
            "stage": record.stage,
            "message": record.message,
            "input_path": record.input_path,
            "secret_path": record.secret_path,
            "output_path": record.output_path,
            "output_name": record.output_name,
            "access_key": record.access_key,
            "integrity_hash": record.integrity_hash,
            "metadata": record.metadata,
            "device_info": record.device_info,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
        }},
        upsert=True
    )


def _store_job_record(record: JobRecord) -> None:
    jobs[record.job_id] = record
    _persist_job_record(record)


async def create_encode_job(
    modality: str,
    cover_file: UploadFile,
    secret_file: UploadFile,
    embedding_type: str,
    cover_meta: ValidatedUpload,
    secret_meta: ValidatedUpload,
    user_id: str,
) -> dict:
    job_id = uuid4().hex
    cover_bytes = await _save_upload(cover_file)
    secret_bytes = await _save_upload(secret_file)

    input_path = await asyncio.to_thread(save_file, cover_bytes, cover_meta.filename)
    secret_path = await asyncio.to_thread(save_file, secret_bytes, secret_meta.filename)

    record = JobRecord(
        job_id=job_id,
        job_type="encode",
        modality=modality,
        user_id=user_id,
        input_path=input_path,
        secret_path=secret_path,
        metadata={"embedding_type": embedding_type, "input_name": cover_meta.filename},
    )
    _store_job_record(record)

    await queue_manager.enqueue(lambda: _run_encode_job(record, cover_bytes, cover_meta.filename, secret_meta.filename))
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Encoding job queued",
    }


async def create_decode_job(
    modality: str,
    stego_file: UploadFile,
    access_key: str,
    enhance: bool,
    stego_meta: ValidatedUpload,
    user_id: str,
) -> dict:
    job_id = uuid4().hex
    stego_bytes = await _save_upload(stego_file)
    input_path = await asyncio.to_thread(save_file, stego_bytes, stego_meta.filename)

    record = JobRecord(
        job_id=job_id,
        job_type="decode",
        modality=modality,
        user_id=user_id,
        input_path=input_path,
        access_key=access_key,
        metadata={"input_name": stego_meta.filename, "enhance": enhance},
    )
    _store_job_record(record)

    await queue_manager.enqueue(lambda: _run_decode_job(record, stego_bytes, stego_meta.filename))
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Decoding job queued",
    }


async def _run_encode_job(record: JobRecord, cover_bytes: bytes, cover_name: str, secret_name: str) -> None:
    try:
        runtime = get_runtime_profile()
        record.status = "running"
        record.progress = 10
        record.stage = "preparing"
        record.message = "Preparing tensors and runtime"
        record.device_info = runtime.__dict__
        _store_job_record(record)
        await asyncio.sleep(0)

        if record.secret_path is None:
            raise ValueError("Secret path is not defined")
        secret_bytes = await asyncio.to_thread(get_file_bytes, record.secret_path)
        access_key = generate_access_key()
        record.progress = 30
        record.stage = "inference"
        record.message = "Running encoder model"
        _store_job_record(record)

        embedding_type = record.metadata.get("embedding_type", "adaptive")
        processed_cover = await _get_model_service().encode(
            record.modality,
            cover_bytes,
            secret_bytes,
            runtime,
            embedding_type,
        )

        record.progress = 70
        record.stage = "securing"
        record.message = "Encrypting payload and binding key to file signature"
        _store_job_record(record)

        associated_data = (await asyncio.to_thread(derive_file_signature, processed_cover)).encode("utf-8")
        encrypted = await asyncio.to_thread(encrypt_secret, secret_bytes, access_key, associated_data)
        container = await asyncio.to_thread(
            build_container,
            cover_bytes=processed_cover,
            encrypted_payload=encrypted,
            access_key=access_key,
            modality=record.modality,
            secret_name=secret_name,
        )

        output_name = stego_output_name(record.job_id, cover_name, "encode")
        output_path_str = await asyncio.to_thread(save_file, container, output_name)

        record.status = "completed"
        record.progress = 100
        record.stage = "done"
        record.message = "Stego artifact ready"
        record.output_path = output_path_str
        record.output_name = output_name
        record.access_key = access_key
        record.integrity_hash = await asyncio.to_thread(sha256_hex, container)
        _store_job_record(record)
    except Exception as exc:
        record.status = "failed"
        record.stage = "failed"
        record.message = str(exc)
        _store_job_record(record)


async def _run_decode_job(record: JobRecord, stego_bytes: bytes, _stego_name: str) -> None:
    try:
        runtime = get_runtime_profile()
        record.status = "running"
        record.progress = 10
        record.stage = "validating"
        record.message = "Validating stego container"
        record.device_info = runtime.__dict__
        _store_job_record(record)
        await asyncio.sleep(0)

        cover_bytes, metadata, encrypted_payload = await asyncio.to_thread(split_container, stego_bytes)
        file_signature = await asyncio.to_thread(derive_file_signature, cover_bytes)
        expected_binding = build_key_binding(record.access_key or "", file_signature)
        if metadata["key_binding"] != expected_binding:
            raise ValueError("Invalid key or tampered file detected")

        associated_data = file_signature.encode("utf-8")
        record.progress = 40
        record.stage = "decrypting"
        record.message = "Decrypting protected payload"
        _store_job_record(record)
        secret_bytes = await asyncio.to_thread(decrypt_secret, encrypted_payload, record.access_key or "", associated_data)

        record.progress = 70
        record.stage = "inference"
        record.message = "Running decoder model"
        _store_job_record(record)
        revealed_bytes = await _get_model_service().decode(record.modality, cover_bytes, secret_bytes, runtime)

        # Enhance quality of decoded image/video
        enhance = record.metadata.get("enhance", True)
        if enhance:
            record.progress = 85
            record.stage = "enhancing"
            record.message = "Enhancing decoded image/video quality"
            _store_job_record(record)
            revealed_bytes = await asyncio.to_thread(enhance_media, revealed_bytes, metadata["secret_name"])

        output_name = stego_output_name(record.job_id, metadata["secret_name"], "decode")
        output_path_str = await asyncio.to_thread(save_file, revealed_bytes, output_name)

        record.status = "completed"
        record.progress = 100
        record.stage = "done"
        record.message = "Hidden content extracted"
        record.output_path = output_path_str
        record.output_name = output_name
        record.integrity_hash = await asyncio.to_thread(sha256_hex, revealed_bytes)
        _store_job_record(record)
    except Exception as exc:
        record.status = "failed"
        record.stage = "failed"
        record.message = str(exc)
        _store_job_record(record)
