import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { exportAll, importBundle, type ImportMode } from '../db/exportImport';
import { db } from '../db/database';

export function SettingsPage() {
  const { refresh, users, folders, items, attempts } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImport(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await importBundle(file, mode);
      refresh();
      setMsg(
        `İçe aktarıldı: ${r.users} kullanıcı, ${r.folders} klasör, ${r.items} içerik, ${r.attempts} sonuç.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'İçe aktarma başarısız');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleWipe() {
    if (
      !confirm(
        'TÜM veriler silinecek (kullanıcılar, klasörler, içerikler, sonuçlar). Emin misin?',
      )
    )
      return;
    if (!confirm('Bu işlem geri alınamaz. Son onay?')) return;
    await db.transaction(
      'rw',
      db.users,
      db.folders,
      db.items,
      db.attempts,
      db.meta,
      async () => {
        await Promise.all([
          db.users.clear(),
          db.folders.clear(),
          db.items.clear(),
          db.attempts.clear(),
          db.meta.clear(),
        ]);
      },
    );
    window.location.reload();
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ayarlar</p>
          <h1>Veri & paylaşım</h1>
          <p className="muted">
            Her şey tarayıcında (IndexedDB) saklanır. İstediğin zaman dışa aktarıp
            başka cihazda içe aktarabilirsin.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2>Depolama özeti</h2>
        <ul className="plain-list">
          <li>{users.length} kullanıcı</li>
          <li>{folders.length} klasör</li>
          <li>{items.length} içerik</li>
          <li>{attempts.length} sonuç</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Dışa aktar</h2>
        <p className="muted">
          Tüm veriyi JSON olarak indir. Arkadaşın veya öğrencin içe aktarabilir.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => exportAll()}>
          Tam yedek indir
        </button>
      </section>

      <section className="panel">
        <h2>İçe aktar</h2>
        <label className="field">
          <span>Mod</span>
          <select
            className="input"
            value={mode}
            onChange={(e) => setMode(e.target.value as ImportMode)}
          >
            <option value="merge">Birleştir (üzerine yaz / ekle)</option>
            <option value="replace">Değiştir (önce her şeyi sil)</option>
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
          }}
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Aktarılıyor…' : 'JSON dosyası seç'}
        </button>
        {msg && <p className="notice">{msg}</p>}
      </section>

      <section className="panel">
        <h2>PWA / çevrimdışı</h2>
        <p className="muted">
          Uygulamayı ana ekrana ekleyebilirsin. Kurulumdan sonra internet olmasa
          da çalışır; veriler yine yerel kalır.
        </p>
        <InstallHint />
      </section>

      <section className="panel danger-zone">
        <h2>Tehlikeli alan</h2>
        <p className="muted">Tüm yerel veriyi siler. Önce yedek alman önerilir.</p>
        <button type="button" className="btn btn--danger" onClick={handleWipe}>
          Tüm veriyi sil
        </button>
      </section>
    </div>
  );
}

function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred) {
    return (
      <p className="tiny muted">
        Tarayıcı menüsünden “Ana ekrana ekle” / “Install app” seçeneğini kullan.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn btn--primary"
      onClick={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
    >
      Uygulamayı yükle
    </button>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
