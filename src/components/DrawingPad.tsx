import { useEffect, useRef, useState } from 'react';

type Tool = 'pen' | 'eraser';

/**
 * Kalıcı çizim alanı.
 * Tuval yalnızca silgi ile dokunulunca silinir; yeniden çizim / resize içeriği bozmaz.
 */
export function DrawingPad({
  value,
  onChange,
  label = 'Kalem alanı',
  height = 260,
}: {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const toolRef = useRef<Tool>('pen');
  const seeded = useRef(false);
  const [tool, setTool] = useState<Tool>('pen');

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const cssW = Math.max(280, parent?.clientWidth || 600);
    const ratio = window.devicePixelRatio || 1;

    // Boyut zaten doğruysa dokunma
    const targetW = Math.floor(cssW * ratio);
    const targetH = Math.floor(height * ratio);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      const snapshot =
        canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL('image/png') : '';
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Beyaz zemin (ızgara CSS'te)
      ctx.fillStyle = '#fbfdfb';
      ctx.fillRect(0, 0, cssW, height);

      const restoreSrc = snapshot || value || '';
      if (restoreSrc) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cssW, height);
          seeded.current = true;
        };
        img.src = restoreSrc;
      } else {
        seeded.current = true;
      }
    } else if (!seeded.current && value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssW, height);
        seeded.current = true;
      };
      img.src = value;
    } else if (!seeded.current) {
      seeded.current = true;
    }
    // value değişince tuvali yeniden boyama — bilinçli olarak yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;

    // Tek dokunuşta nokta da kalsın
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.1, 0, Math.PI * 2);
    applyStrokeStyle(ctx);
    ctx.stroke();
  }

  function applyStrokeStyle(ctx: CanvasRenderingContext2D) {
    if (toolRef.current === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 18;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#15231f';
      ctx.lineWidth = 3;
    }
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    applyStrokeStyle(ctx);
    ctx.stroke();
    last.current = p;
  }

  function end(e: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onChange(canvas.toDataURL('image/png'));
  }

  return (
    <div className="drawing-pad">
      <div className="drawing-pad__toolbar">
        <span className="tiny muted">{label}</span>
        <div className="hero-actions">
          <button
            type="button"
            className={`btn btn--small ${tool === 'pen' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTool('pen')}
          >
            Kalem
          </button>
          <button
            type="button"
            className={`btn btn--small ${tool === 'eraser' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTool('eraser')}
          >
            Silgi
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="drawing-pad__canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <p className="tiny muted">
        Yazı kalır. Yalnızca Silgi seçiliyken dokununca silinir.
      </p>
    </div>
  );
}
