import React from "react";
import { Button } from "@/components/ui/Button";

type SignaturePadProps = {
  title: string;
  value?: string | null;
  onApply: (dataUrl: string) => void;
  onClear?: () => void;
  className?: string;
};

type Point = { x: number; y: number };
type Stroke = Point[];

const PAD_HEIGHT = 168;

function isDataUrlImage(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^data:image\//.test(value);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.length) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.2;

  if (stroke.length === 1) {
    const p = stroke[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length; i += 1) {
    const prev = stroke[i - 1];
    const curr = stroke[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function SignaturePad({ title, value, onApply, onClear, className = "" }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const strokesRef = React.useRef<Stroke[]>([]);
  const activeStrokeRef = React.useRef<Stroke | null>(null);
  const pointerIdRef = React.useRef<number | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);

  const redrawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const cssWidth = Math.max(220, Math.floor(rect.width));
    const cssHeight = PAD_HEIGHT;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  React.useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  React.useEffect(() => {
    const onResize = () => redrawCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redrawCanvas]);

  const eventPoint = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== null) return;
    const point = eventPoint(event);
    if (!point) return;
    pointerIdRef.current = event.pointerId;
    activeStrokeRef.current = [point];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const point = eventPoint(event);
    if (!point || !activeStrokeRef.current) return;
    activeStrokeRef.current.push(point);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const stroke = activeStrokeRef.current;
    if (stroke.length >= 2) {
      const prev = stroke[stroke.length - 2];
      const curr = stroke[stroke.length - 1];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (stroke.length === 2) ctx.moveTo(prev.x, prev.y);
      else {
        const beforePrev = stroke[stroke.length - 3];
        const startX = (beforePrev.x + prev.x) / 2;
        const startY = (beforePrev.y + prev.y) / 2;
        ctx.moveTo(startX, startY);
      }
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      ctx.stroke();
    }
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    if (activeStrokeRef.current && activeStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
      activeStrokeRef.current = null;
      redrawCanvas();
      if (canvasRef.current) {
        onApply(canvasRef.current.toDataURL("image/png"));
      }
      setIsDirty(false);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setIsDirty(false);
    redrawCanvas();
    onClear?.();
  };

  const handleApply = () => {
    if (!canvasRef.current) return;
    const hasStroke = strokesRef.current.length > 0;
    if (!hasStroke && isDataUrlImage(value)) {
      onApply(value);
      return;
    }
    if (!hasStroke) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onApply(dataUrl);
    setIsDirty(false);
  };

  return (
    <div className={`signature-pad-card ${className}`.trim()}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--text-main)]">{title}</p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="rounded-full px-3 py-1 text-xs" onClick={handleClear}>
            Löschen
          </Button>
          <Button type="button" className="rounded-full px-3 py-1 text-xs" onClick={handleApply} disabled={!isDirty && !isDataUrlImage(value)}>
            Übernehmen
          </Button>
        </div>
      </div>

      <div ref={wrapperRef} className="signature-pad-surface">
        <canvas
          ref={canvasRef}
          className="signature-pad-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>

      {isDataUrlImage(value) ? (
        <div className="mt-2 rounded-lg border border-[var(--line)] bg-slate-950/25 p-2">
          <p className="mb-1 text-[11px] text-[var(--text-soft)]">Gespeicherte Signatur</p>
          <img src={value} alt={`${title} Vorschau`} className="signature-pad-preview" />
        </div>
      ) : null}
    </div>
  );
}

