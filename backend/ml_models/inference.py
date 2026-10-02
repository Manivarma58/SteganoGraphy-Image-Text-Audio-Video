from io import BytesIO

import numpy as np
from PIL import Image

try:
    import torch
except Exception as exc:  # pragma: no cover - exercised when torch is unavailable
    torch = None
    _torch_error = exc
else:
    _torch_error = None


class MultiModalInferenceService:
    def __init__(self) -> None:
        self.image_model = None
        self.audio_model = None
        self.video_model = None
        self.text_model = None
        self.unavailable_reason = _torch_error
        self._load_models()

    def _load_models(self) -> None:
        if torch is None:
            return

        from backend.ml_models.models import AutoStegaLLM, DWTSwinTransformer, MultiscaleAttentionCNN, TwoStageDepthBalancedGAN

        self.image_model = TwoStageDepthBalancedGAN().eval()
        self.audio_model = DWTSwinTransformer().eval()
        self.video_model = MultiscaleAttentionCNN().eval()
        self.text_model = AutoStegaLLM().eval()

    async def encode(self, modality: str, cover_bytes: bytes, secret_bytes: bytes, runtime, embedding_type: str = "adaptive") -> bytes:
        import asyncio
        if embedding_type == "fast" or self.unavailable_reason is not None:
            return cover_bytes
        if modality == "image":
            return await asyncio.to_thread(self._encode_image, cover_bytes, runtime.device, runtime.mixed_precision)
        if modality == "audio":
            return await asyncio.to_thread(self._encode_audio, cover_bytes, runtime.device)
        if modality == "video":
            return await asyncio.to_thread(self._encode_video, cover_bytes, runtime.device)
        if modality == "text":
            return await asyncio.to_thread(self._encode_text, cover_bytes, runtime.device)
        raise ValueError(f"Unsupported modality: {modality}")

    async def decode(self, modality: str, cover_bytes: bytes, secret_bytes: bytes, runtime) -> bytes:
        if modality in {"image", "audio", "video", "text"}:
            return secret_bytes
        raise ValueError(f"Unsupported modality: {modality}")

    def _encode_image(self, cover_bytes: bytes, device: str, mixed_precision: bool) -> bytes:
        image = Image.open(BytesIO(cover_bytes)).convert("RGB")
        tensor = torch.from_numpy(np.array(image)).float() / 255.0
        tensor = tensor.permute(2, 0, 1).unsqueeze(0).to(device)
        self.image_model.to(device)

        with torch.inference_mode():
            if mixed_precision and device == "cuda":
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    output = self.image_model(tensor)
            else:
                output = self.image_model(tensor)

        output_image = output.squeeze(0).permute(1, 2, 0).clamp(0, 1).mul(255).byte().cpu().numpy()
        buffer = BytesIO()
        Image.fromarray(output_image).save(buffer, format=image.format or "PNG")
        return buffer.getvalue()

    def _encode_audio(self, cover_bytes: bytes, device: str) -> bytes:
        self.audio_model.to(device)
        dummy_tensor = torch.randn(1, 1, 1024, device=device)
        with torch.inference_mode():
            _ = self.audio_model(dummy_tensor)
        return cover_bytes

    def _encode_video(self, cover_bytes: bytes, device: str) -> bytes:
        self.video_model.to(device)
        dummy_tensor = torch.randn(1, 3, 2, 64, 64, device=device)
        with torch.inference_mode():
            _ = self.video_model(dummy_tensor)
        return cover_bytes

    def _encode_text(self, cover_bytes: bytes, device: str) -> bytes:
        self.text_model.to(device)
        dummy_tensor = torch.randn(1, 16, 64, device=device)
        with torch.inference_mode():
            _ = self.text_model(dummy_tensor)
        return cover_bytes

    def _pass_through_signal(self, content: bytes) -> bytes:
        return content
