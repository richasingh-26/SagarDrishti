"""Strict local U-Net++ inference for Sentinel-1 scenes."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import numpy as np
from PIL import Image

from schemas import DetectResponse

SAR_DIR = os.path.join(os.path.dirname(__file__), "data", "sentinel1")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "unet_oil_spill_final.pth")


class InferenceUnavailable(RuntimeError):
    """Genuine model inference cannot be performed."""


@dataclass
class ModelState:
    model: Any = None
    device: str = "unavailable"
    error: str | None = "Model has not been loaded"


_model_state = ModelState()


def get_sar_path() -> str | None:
    """Use only the explicitly named Sentinel-1 scene requested for inference."""
    path = os.path.join(SAR_DIR, "sentinel1_sar.tiff")
    return path if os.path.isfile(path) else None


def _build_unetplusplus() -> Any:
    try:
        import segmentation_models_pytorch as smp
        return smp.UnetPlusPlus(encoder_name="resnet34", encoder_weights=None, in_channels=1, classes=1)
    except ImportError:
        pass

    # Pure PyTorch UNet++ fallback
    import torch.nn as nn
    class ConvBlock(nn.Module):
        def __init__(self, in_c, out_c):
            super().__init__()
            self.conv = nn.Sequential(
                nn.Conv2d(in_c, out_c, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_c),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_c, out_c, 3, padding=1, bias=False),
                nn.BatchNorm2d(out_c),
                nn.ReLU(inplace=True)
            )
        def forward(self, x):
            return self.conv(x)

    class NativeUNetPlusPlus(nn.Module):
        def __init__(self, in_channels=1, out_channels=1, nb_filter=[16, 32, 64, 128, 256]):
            super().__init__()
            self.pool = nn.MaxPool2d(2, 2)
            self.up = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=True)
            self.conv0_0 = ConvBlock(in_channels, nb_filter[0])
            self.conv1_0 = ConvBlock(nb_filter[0], nb_filter[1])
            self.conv2_0 = ConvBlock(nb_filter[1], nb_filter[2])
            self.conv3_0 = ConvBlock(nb_filter[2], nb_filter[3])
            self.conv4_0 = ConvBlock(nb_filter[3], nb_filter[4])
            self.conv0_1 = ConvBlock(nb_filter[0] + nb_filter[1], nb_filter[0])
            self.conv1_1 = ConvBlock(nb_filter[1] + nb_filter[2], nb_filter[1])
            self.conv2_1 = ConvBlock(nb_filter[2] + nb_filter[3], nb_filter[2])
            self.conv3_1 = ConvBlock(nb_filter[3] + nb_filter[4], nb_filter[3])
            self.conv0_2 = ConvBlock(nb_filter[0]*2 + nb_filter[1], nb_filter[0])
            self.conv1_2 = ConvBlock(nb_filter[1]*2 + nb_filter[2], nb_filter[1])
            self.conv2_2 = ConvBlock(nb_filter[2]*2 + nb_filter[3], nb_filter[2])
            self.conv0_3 = ConvBlock(nb_filter[0]*3 + nb_filter[1], nb_filter[0])
            self.conv1_3 = ConvBlock(nb_filter[1]*3 + nb_filter[2], nb_filter[1])
            self.conv0_4 = ConvBlock(nb_filter[0]*4 + nb_filter[1], nb_filter[0])
            self.final = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)
        def forward(self, x):
            x0_0 = self.conv0_0(x)
            x1_0 = self.conv1_0(self.pool(x0_0))
            x0_1 = self.conv0_1(torch.cat([x0_0, self.up(x1_0)], 1))
            x2_0 = self.conv2_0(self.pool(x1_0))
            x1_1 = self.conv1_1(torch.cat([x1_0, self.up(x2_0)], 1))
            x0_2 = self.conv0_2(torch.cat([x0_0, x0_1, self.up(x1_1)], 1))
            x3_0 = self.conv3_0(self.pool(x2_0))
            x2_1 = self.conv2_1(torch.cat([x2_0, self.up(x3_0)], 1))
            x1_2 = self.conv1_2(torch.cat([x1_0, x1_1, self.up(x2_1)], 1))
            x0_3 = self.conv0_3(torch.cat([x0_0, x0_1, x0_2, self.up(x1_2)], 1))
            x4_0 = self.conv4_0(self.pool(x3_0))
            x3_1 = self.conv3_1(torch.cat([x3_0, self.up(x4_0)], 1))
            x2_2 = self.conv2_2(torch.cat([x2_0, x2_1, self.up(x3_1)], 1))
            x1_3 = self.conv1_3(torch.cat([x1_0, x1_1, x1_2, self.up(x2_2)], 1))
            x0_4 = self.conv0_4(torch.cat([x0_0, x0_1, x0_2, x0_3, self.up(x1_3)], 1))
            return self.final(x0_4)

    return NativeUNetPlusPlus()


def load_unet_model() -> ModelState:
    """Load weights once at application startup; never substitute a heuristic."""
    global _model_state
    if not os.path.isfile(MODEL_PATH):
        _model_state = ModelState(error=f"Model weights not found: {MODEL_PATH}")
        return _model_state
    try:
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            model = torch.jit.load(MODEL_PATH, map_location=device)
        except Exception:
            checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
            if isinstance(checkpoint, torch.nn.Module):
                model = checkpoint
            elif isinstance(checkpoint, dict) and isinstance(checkpoint.get("model"), torch.nn.Module):
                model = checkpoint["model"]
            else:
                state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint)) if isinstance(checkpoint, dict) else checkpoint
                if not isinstance(state_dict, dict):
                    raise InferenceUnavailable("Unsupported checkpoint format")
                model = _build_unetplusplus()
                model.load_state_dict({key.removeprefix("module."): value for key, value in state_dict.items()}, strict=False)
        model.to(device)
        model.eval()
        _model_state = ModelState(model=model, device=device, error=None)
    except Exception as exc:
        _model_state = ModelState(error=f"Could not load U-Net++ weights: {exc}")
    return _model_state


def model_status() -> dict[str, str | bool | None]:
    return {"loaded": _model_state.model is not None, "device": _model_state.device if _model_state.model is not None else None, "error": _model_state.error}


def _scene_tensor(path: str, torch: Any) -> tuple[Any, tuple[int, int]]:
    raw = np.asarray(Image.open(path), dtype=np.float32)
    if raw.ndim == 3:
        raw = raw.mean(axis=2)
    usable = raw[np.isfinite(raw)]
    if raw.ndim != 2 or usable.size == 0:
        raise InferenceUnavailable("SAR image must be a non-empty raster")
    low, high = np.percentile(usable, [1, 99])
    if high <= low:
        raise InferenceUnavailable("SAR image has no usable intensity range")
    normalised = np.clip((raw - low) / (high - low), 0.0, 1.0).astype(np.float32)
    return torch.from_numpy(normalised).unsqueeze(0).unsqueeze(0), raw.shape


def detect_local_sar() -> DetectResponse:
    """Run U-Net++ on the local Sentinel-1 image and return only model output."""
    path = get_sar_path()
    if path is None:
        raise FileNotFoundError("No SAR image loaded")
    if _model_state.model is None:
        raise InferenceUnavailable(_model_state.error or "U-Net++ model is not loaded")
    try:
        import torch
        import torch.nn.functional as functional
    except ImportError as exc:
        raise InferenceUnavailable("PyTorch is not installed") from exc

    image, original_size = _scene_tensor(path, torch)
    image = image.to(_model_state.device)
    model_input = functional.interpolate(image, size=(256, 256), mode="bilinear", align_corners=False)
    with torch.inference_mode():
        output = _model_state.model(model_input)
        if isinstance(output, (list, tuple)):
            output = output[0]
        if output.ndim != 4 or output.shape[1] != 1:
            raise InferenceUnavailable(f"Expected one-channel model output, received shape {tuple(output.shape)}")
        probabilities = functional.interpolate(torch.sigmoid(output), size=original_size, mode="bilinear", align_corners=False)

    probability_map = probabilities.squeeze().detach().cpu().numpy()
    mask = probability_map >= 0.5
    coverage = float(mask.mean() * 100.0)
    # Direct summary of predicted probabilities; this is not model accuracy.
    confidence = float(probability_map[mask].mean()) if mask.any() else float(probability_map.mean())
    return DetectResponse(
        spill_detected=bool(mask.any()),
        detection_percentage=round(coverage, 4),
        confidence=round(confidence, 6),
        area_km2=None,
        coordinates=[],
    )


def get_local_sar_analysis() -> dict[str, Any] | None:
    """Return segmented binary mask and probability map from real Sentinel-1 SAR inference."""
    path = get_sar_path()
    if path is None or _model_state.model is None:
        return None
    try:
        import torch
        import torch.nn.functional as functional
        image, original_size = _scene_tensor(path, torch)
        image = image.to(_model_state.device)
        model_input = functional.interpolate(image, size=(256, 256), mode="bilinear", align_corners=False)
        with torch.inference_mode():
            output = _model_state.model(model_input)
            if isinstance(output, (list, tuple)):
                output = output[0]
            probabilities = functional.interpolate(torch.sigmoid(output), size=original_size, mode="bilinear", align_corners=False)
        prob_map = probabilities.squeeze().detach().cpu().numpy()
        return {
            "mask": (prob_map >= 0.5).astype(np.uint8),
            "probability_map": prob_map,
        }
    except Exception as exc:
        print(f"SAR analysis error: {exc}")
        return None
