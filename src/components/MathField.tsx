import katex from 'katex';
import { useMemo } from 'react';
import 'katex/dist/katex.min.css';

export function MathDisplay({
  latex,
  display = false,
}: {
  latex: string;
  display?: boolean;
}) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: display,
      });
    } catch {
      return latex;
    }
  }, [latex, display]);

  return (
    <span
      className={`math-display ${display ? 'math-display--block' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const MATH_CHIPS = [
  { label: '²', insert: '^2' },
  { label: '³', insert: '^3' },
  { label: '√', insert: '\\sqrt{}' },
  { label: '÷', insert: '\\div' },
  { label: '×', insert: '\\times' },
  { label: '±', insert: '\\pm' },
  { label: '≤', insert: '\\leq' },
  { label: '≥', insert: '\\geq' },
  { label: '≠', insert: '\\neq' },
  { label: 'π', insert: '\\pi' },
  { label: '∞', insert: '\\infty' },
  { label: '½', insert: '\\frac{1}{2}' },
  { label: 'a/b', insert: '\\frac{}{}' },
  { label: '∑', insert: '\\sum' },
  { label: '∫', insert: '\\int' },
  { label: '()', insert: '\\left(\\right)' },
];

export function MathInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="math-input">
      <div className="math-chips">
        {MATH_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className="chip"
            onClick={() => onChange(value + c.insert)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        className="input mono"
        rows={2}
        value={value}
        placeholder={placeholder ?? 'LaTeX veya düz metin yazın…'}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() && (
        <div className="math-preview">
          <span className="muted tiny">Önizleme</span>
          <MathDisplay latex={value} display />
        </div>
      )}
    </div>
  );
}
