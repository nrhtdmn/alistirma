import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Folder } from '../types';

function buildTree(folders: Folder[], parentId: string | null): Folder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'tr'));
}

function Node({
  folder,
  depth,
  activeId,
  onSelect,
  all,
}: {
  folder: Folder;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  all: Folder[];
}) {
  const [open, setOpen] = useState(true);
  const children = buildTree(all, folder.id);
  const isActive = activeId === folder.id;

  return (
    <div className="tree-node">
      <div
        className={`tree-row ${isActive ? 'is-active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Kapat' : 'Aç'}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle spacer" />
        )}
        <button
          type="button"
          className="tree-label"
          onClick={() => onSelect(folder.id)}
        >
          <span className="dot" style={{ background: folder.color }} />
          {folder.name}
        </button>
      </div>
      {open &&
        children.map((c) => (
          <Node
            key={c.id}
            folder={c}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
            all={all}
          />
        ))}
    </div>
  );
}

export function FolderTree({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { folders } = useApp();
  const roots = useMemo(() => buildTree(folders, null), [folders]);

  return (
    <div className="folder-tree">
      <button
        type="button"
        className={`tree-row root ${activeId === null ? 'is-active' : ''}`}
        onClick={() => onSelect(null)}
      >
        Tüm içerikler
      </button>
      {roots.map((f) => (
        <Node
          key={f.id}
          folder={f}
          depth={0}
          activeId={activeId}
          onSelect={onSelect}
          all={folders}
        />
      ))}
      {roots.length === 0 && (
        <p className="muted tiny pad">Henüz klasör yok.</p>
      )}
    </div>
  );
}

export function FolderBreadcrumb({
  folderId,
}: {
  folderId: string | null;
}) {
  const { folders } = useApp();
  const path: Folder[] = [];
  let cur = folderId;
  while (cur) {
    const f = folders.find((x) => x.id === cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }

  return (
    <nav className="breadcrumb" aria-label="Klasör yolu">
      <Link to="/klasorler">Kök</Link>
      {path.map((f) => (
        <span key={f.id}>
          <span className="sep">/</span>
          <Link to={`/klasorler/${f.id}`}>{f.name}</Link>
        </span>
      ))}
    </nav>
  );
}
