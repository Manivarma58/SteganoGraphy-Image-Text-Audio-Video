from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from backend.schemas.jobs import JobStatusResponse
from backend.services.auth import get_current_user
from backend.services.job_service import get_job, get_user_job_records

router = APIRouter(tags=["jobs"])


import os
import time
from backend.services.db import jobs_col
from backend.services.model_runtime import get_runtime_profile

START_TIME = time.time()


@router.get("/jobs/me", response_model=list[JobStatusResponse])
async def get_my_jobs(current_user: dict = Depends(get_current_user)) -> list[JobStatusResponse]:
    if jobs_col is None:
        return []
    records = get_user_job_records(current_user["id"])
    return [JobStatusResponse.model_validate(record.to_response()) for record in records]


@router.delete("/jobs/me")
async def clear_my_jobs(current_user: dict = Depends(get_current_user)) -> dict:
    if jobs_col is None:
        return {"status": "success", "message": "No jobs to clear"}
    # Delete database job records and associated GridFS/local files
    rows = list(jobs_col.find({"user_id": current_user["id"]}, {"output_path": 1, "input_path": 1, "secret_path": 1}))
    from backend.services.db import delete_file
    for row in rows:
        for key in ["output_path", "input_path", "secret_path"]:
            path = row.get(key)
            if path:
                try:
                    delete_file(path)
                except Exception:
                    pass
    
    # Delete database job records
    jobs_col.delete_many({"user_id": current_user["id"]})
    return {"status": "success", "message": "All jobs cleared successfully"}


@router.get("/jobs/metrics")
async def get_jobs_metrics(current_user: dict = Depends(get_current_user)) -> dict:
    if jobs_col is None:
        return {
            "storage_used": 0,
            "storage_total": 50 * 1024 * 1024 * 1024,
            "file_count": 0,
            "latency": "15ms",
            "throughput": "0.00 MB/s",
            "uptime": "0m 0s",
            "device": get_runtime_profile().device.upper(),
            "key_auth": "ACTIVE",
        }

    # Calculate storage used by completed jobs of current user
    total_bytes = 0
    rows = list(jobs_col.find({"status": "completed", "user_id": current_user["id"]}, {"output_path": 1}))
    for row in rows:
        path = row.get("output_path")
        if path:
            if path.startswith("gridfs://"):
                try:
                    from backend.services.db import fs
                    from bson.objectid import ObjectId
                    file_id_str = path.replace("gridfs://", "")
                    grid_out = fs.get(ObjectId(file_id_str))
                    total_bytes += grid_out.length
                except Exception:
                    pass
            elif os.path.exists(path):
                try:
                    total_bytes += os.path.getsize(path)
                except OSError:
                    pass

    # Count files
    file_count = jobs_col.count_documents({"status": "completed", "user_id": current_user["id"]})

    # Calculate average duration/latency of last few jobs
    avg_latency = 15.0
    durations = []
    time_rows = list(jobs_col.find(
        {"status": "completed", "user_id": current_user["id"]},
        {"created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).limit(10))
    
    from datetime import datetime
    for r in time_rows:
        try:
            c_time = datetime.fromisoformat(r["created_at"])
            u_time = datetime.fromisoformat(r["updated_at"])
            durations.append((u_time - c_time).total_seconds())
        except (ValueError, TypeError):
            pass
            
    if durations:
        avg_latency = sum(durations) / len(durations)
        latency_str = f"{avg_latency:.2f}s"
    else:
        latency_str = "15ms"

    # Throughput calculation
    throughput_val = "2.4 GB/s"
    if durations and total_bytes:
        total_seconds = sum(durations)
        if total_seconds > 0:
            mb_per_sec = (total_bytes / (1024 * 1024)) / total_seconds
            if mb_per_sec > 1024:
                throughput_val = f"{mb_per_sec/1024:.2f} GB/s"
            else:
                throughput_val = f"{mb_per_sec:.2f} MB/s"

    # Uptime calculation
    uptime_sec = time.time() - START_TIME
    hours, remainder = divmod(int(uptime_sec), 3600)
    minutes, seconds = divmod(remainder, 60)
    uptime_str = f"{hours}h {minutes}m {seconds}s" if hours > 0 else f"{minutes}m {seconds}s"

    # Active processing device
    runtime = get_runtime_profile()
    device_name = runtime.device.upper()

    return {
        "storage_used": total_bytes,
        "storage_total": 50 * 1024 * 1024 * 1024, # 50 GB
        "file_count": file_count,
        "latency": latency_str,
        "throughput": throughput_val,
        "uptime": uptime_str,
        "device": device_name,
        "key_auth": "ACTIVE",
    }


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, current_user: dict = Depends(get_current_user)) -> JobStatusResponse:
    job = get_job(job_id)
    if not job or job.user_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse.model_validate(job.to_response())


@router.get("/jobs/{job_id}/artifact")
async def download_artifact(job_id: str, current_user: dict = Depends(get_current_user)):
    job = get_job(job_id)
    if not job or job.user_id != current_user["id"] or not job.output_path:
        raise HTTPException(status_code=404, detail="Artifact not available")
        
    if job.output_path.startswith("gridfs://"):
        from backend.services.db import fs
        from bson.objectid import ObjectId
        from fastapi.responses import StreamingResponse
        import mimetypes
        try:
            file_id_str = job.output_path.replace("gridfs://", "")
            grid_out = fs.get(ObjectId(file_id_str))
            
            # Guess content type or default to binary stream
            media_type, _ = mimetypes.guess_type(job.output_name or "")
            if not media_type:
                media_type = "application/octet-stream"
                
            def iter_file():
                # Reset stream pointer to beginning just in case
                grid_out.seek(0)
                while chunk := grid_out.read(1024 * 1024):  # 1MB chunks
                    yield chunk
                    
            return StreamingResponse(
                iter_file(),
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{job.output_name}"',
                    "Content-Length": str(grid_out.length)
                }
            )
        except Exception as e:
            print(f"Error downloading artifact from GridFS: {e}")
            raise HTTPException(status_code=404, detail="Artifact not found in database")
    else:
        return FileResponse(path=job.output_path, filename=job.output_name)


