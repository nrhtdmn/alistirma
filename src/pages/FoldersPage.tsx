import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FolderBreadcrumb, FolderTree } from '../components/FolderTree';
import { Modal } from '../components/Modal';
import { useApp } from '../context/AppContext';
import { exportFolderTree, exportItems } from '../db/exportImport';
import {
  ITEM_TYPE_LABELS,
  SUBJECT_LABELS,
  USER_COLORS,
  type ContentItem,
} from '../types';

export function FoldersPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const {
    folders,
    items,
    addFolder,
    updateFolder,
    deleteFolder,
    deleteItem,
  } = useApp();

  const activeId = folderId ?? null;
  const [newName, setNewName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  /** null = kök, string = bu klasörün altına */
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const activeFolder = folders.find((f) => f.id === activeId) ?? null;

  const childFolders = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === activeId)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'tr')),
    [folders, activeId],
  );

  const childItems = useMemo(
    () =>
      items.filter((i) =>
        activeId === null ? i.folderId === null : i.folderId === activeId,
      ),
    [items, activeId],
  );

  const createParentName = useMemo(() => {
    if (createParentId === null) return 'Kök (üst seviye)';
    return folders.find((f) => f.id === createParentId)?.name ?? 'Klasör';
  }, [createParentId, folders]);

  function openCreate(parentId: string | null) {
    setCreateParentId(parentId);
    setNewName('');
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleCreateFolder() {
    const name = newName.trim();
    if (!name) {
      setCreateError('Klasör adı yazın');
      return;
    }
    setCreateError(null);
    try {
      const id = await addFolder({
        name,
        parentId: createParentId,
        color: USER_COLORS[folders.length % USER_COLORS.length],
      });
      setNewName('');
      setCreateOpen(false);
      navigate(`/klasorler/${id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Klasör oluşturulamadı');
    }
  }

  async function handleRename() {
    if (!activeFolder) return;
    const name = renameValue.trim();
    if (!name) return;
    await updateFolder({ ...activeFolder, name });
    setRenameOpen(false);
  }

  async function handleDeleteFolder() {
    if (!activeFolder) return;
    if (
      !confirm(
        `"${activeFolder.name}" klasörü ve altındaki her şey silinecek. Emin misin?`,
      )
    )
      return;
    const parent = activeFolder.parentId;
    await deleteFolder(activeFolder.id);
    navigate(parent ? `/klasorler/${parent}` : '/klasorler');
  }

  return (
    <div className="page folders-layout">
      <aside className="folders-side">
        <div className="section__head">
          <h2>Klasörler</h2>
          <button
            type="button"
            className="btn btn--small btn--primary"
            onClick={() => openCreate(activeId)}
            title={
              activeId
                ? 'Seçili klasörün altına alt klasör ekle'
                : 'Kök klasör ekle'
            }
          >
            + Klasör
          </button>
        </div>
        <p className="tiny muted pad">
          {activeFolder
            ? `Yeni klasör “${activeFolder.name}” altına eklenir.`
            : 'Yeni klasör köke eklenir. Alt klasör için önce bir klasöre girin.'}
        </p>
        <FolderTree
          activeId={activeId}
          onSelect={(id) =>
            navigate(id ? `/klasorler/${id}` : '/klasorler')
          }
        />
      </aside>

      <div className="folders-main">
        <header className="page-head">
          <div>
            <FolderBreadcrumb folderId={activeId} />
            <h1>{activeFolder?.name ?? 'Tüm kök içerikler'}</h1>
            <p className="muted">
              {childFolders.length} alt klasör · {childItems.length} içerik
            </p>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => openCreate(activeId)}
            >
              {activeFolder ? '+ Alt klasör' : '+ Klasör'}
            </button>
            <Link
              className="btn btn--ghost"
              to={`/duzenle/yeni${activeId ? `?folder=${activeId}` : ''}`}
            >
              Yeni içerik
            </Link>
            <Link
              className="btn btn--ghost"
              to={`/duzenle/yeni?type=kartlar${activeId ? `&folder=${activeId}` : ''}`}
            >
              Kelime kartları
            </Link>
            {activeFolder && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setRenameValue(activeFolder.name);
                    setRenameOpen(true);
                  }}
                >
                  Yeniden adlandır
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => exportFolderTree(activeFolder.id)}
                >
                  Dışa aktar
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleDeleteFolder}
                >
                  Sil
                </button>
              </>
            )}
          </div>
        </header>

        {childFolders.length > 0 && (
          <section className="section">
            <h2>Alt klasörler</h2>
            <div className="folder-grid">
              {childFolders.map((f) => (
                <div key={f.id} className="folder-tile-wrap">
                  <button
                    type="button"
                    className="folder-tile"
                    onClick={() => navigate(`/klasorler/${f.id}`)}
                  >
                    <span className="dot lg" style={{ background: f.color }} />
                    <strong>{f.name}</strong>
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--ghost folder-tile-add"
                    title="Alt klasör ekle"
                    onClick={() => openCreate(f.id)}
                  >
                    + Alt
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section__head">
            <h2>İçerikler</h2>
            {childItems.length > 0 && (
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => exportItems(childItems.map((i) => i.id))}
              >
                Hepsi dışa aktar
              </button>
            )}
          </div>
          <div className="item-grid">
            {childItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onDelete={async () => {
                  if (!confirm(`"${item.title}" silinsin mi?`)) return;
                  await deleteItem(item.id);
                }}
              />
            ))}
            {childItems.length === 0 && (
              <p className="muted">Bu klasörde içerik yok.</p>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={createOpen}
        title={createParentId ? 'Alt klasör oluştur' : 'Klasör oluştur'}
        onClose={() => setCreateOpen(false)}
      >
        <p className="muted tiny">
          Konum: <strong>{createParentName}</strong>
        </p>
        <label className="field">
          <span>Klasör adı</span>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Örn. 5. Sınıf / Ünite 1"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && void handleCreateFolder()}
          />
        </label>
        {createError && <p className="notice danger-notice">{createError}</p>}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setCreateOpen(false)}
          >
            İptal
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleCreateFolder()}
          >
            Oluştur
          </button>
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        title="Yeniden adlandır"
        onClose={() => setRenameOpen(false)}
      >
        <label className="field">
          <span>Yeni ad</span>
          <input
            className="input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
          />
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setRenameOpen(false)}
          >
            İptal
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleRename()}
          >
            Kaydet
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ItemRow({
  item,
  onDelete,
}: {
  item: ContentItem;
  onDelete: () => void;
}) {
  const isCards = item.type === 'kartlar';
  const count = isCards
    ? (item.cards?.length ?? 0)
    : item.questions.length;
  const solveTo = isCards ? `/kartlar/${item.id}` : `/coz/${item.id}`;

  return (
    <article className="item-card">
      <div className="item-card__meta">
        <span className="tag">{ITEM_TYPE_LABELS[item.type]}</span>
        <span className="tag tag--soft">{SUBJECT_LABELS[item.subject]}</span>
      </div>
      <h3>{item.title}</h3>
      <p className="muted tiny">
        {item.gradeLevel} · {count} {isCards ? 'kart' : 'soru'}
      </p>
      <div className="item-card__actions">
        <Link className="btn btn--small btn--primary" to={solveTo}>
          {isCards ? 'Çalış' : 'Çöz'}
        </Link>
        <Link className="btn btn--small btn--ghost" to={`/duzenle/${item.id}`}>
          Düzenle
        </Link>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => exportItems([item.id])}
        >
          Aktar
        </button>
        <button
          type="button"
          className="btn btn--small btn--danger"
          onClick={onDelete}
        >
          Sil
        </button>
      </div>
    </article>
  );
}
