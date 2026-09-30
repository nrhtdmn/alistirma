import { useEffect, useRef, useState } from 'react';

type Tool = 'pen' | 'eraser';

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
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#15231f');
  const [width, setWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || 600;
      const ratio = window.devicePixelRatio || 1;
      const prev = canvas.toDataURL();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // background
      ctx.fillStyle = '#fbfdfb';
      ctx.fillRect(0, 0, w, height);
      // grid for math
      ctx.strokeStyle = '#e2ebe6';
      ctx.lineWidth = 1;
      for (let y = 32; y < height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      if (value || prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, height);
        img.src = value || prev;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = value;
  }, [value]);

  function pos(e: PointerEvent | React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
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
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = width * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
    }
    ctx.stroke();
    last.current = p;
  }

  function end(e: React.PointerEvent) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fbfdfb';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2ebe6';
    ctx.lineWidth = 1;
    for (let y = 32; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    onChange('');
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
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Renk"
            className="color-pick"
          />
          <label className="tiny inline-field">
            Kalınlık
            <input
              type="range"
              min={1}
              max={12}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn btn--small btn--ghost" onClick={clear}>
            Temizle
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="drawing-pad__canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <p className="tiny muted">Parmak, kalem (stylus) veya fare ile yazabilirsiniz.</p>
    </div>
  );
}
