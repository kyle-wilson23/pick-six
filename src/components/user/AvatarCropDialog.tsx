"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  confirming?: boolean;
};

async function cropToBlob(
  imageSrc: string,
  crop: Area,
  mime: string = "image/jpeg",
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.min(512, Math.round(crop.width));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode image"));
          return;
        }
        resolve(blob);
      },
      mime,
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Image load failed")));
    img.src = src;
  });
}

export function AvatarCropDialog({
  open,
  imageSrc,
  onCancel,
  onConfirm,
  confirming = false,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || confirming || confirmingRef.current) return;
    confirmingRef.current = true;
    setLocalError(null);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, "image/jpeg");
      onConfirm(blob);
    } catch {
      setLocalError("Could not crop image. Try another photo.");
      confirmingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onClose={confirming ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Crop profile picture</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack
            sx={{
              position: "relative",
              width: "100%",
              height: 280,
              bgcolor: "action.hover",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </Stack>
          <Stack spacing={1}>
            <Typography id="avatar-zoom-label" variant="body2" color="text.secondary">
              Zoom
            </Typography>
            <Slider
              aria-labelledby="avatar-zoom-label"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              onChange={(_, value) => setZoom(value as number)}
              disabled={confirming}
            />
          </Stack>
          {localError ? (
            <Typography variant="body2" color="error">
              {localError}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={confirming || !croppedAreaPixels}
        >
          {confirming ? "Uploading…" : "Save photo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
