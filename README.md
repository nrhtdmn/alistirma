# Alıştırma

1. sınıftan doktoraya — öğretmen, öğrenci ve velilerin **alıştırma, test, sınav, quiz ve kelime kartları** oluşturup çözebileceği modern bir **PWA**.

Veriler tarayıcıda (**IndexedDB**) saklanır. İnternet olmadan da çalışır. İstediğiniz her şeyi JSON olarak dışa aktarıp paylaşabilir, içe aktarabilirsiniz.

## Özellikler

- **Çok seviyeli klasörler** (istediğiniz kadar alt klasör)
- **Kelime kartları** (ön/arka yüz, ipucu, örnek cümle, çevirmeli çalışma)
- **Dersler:** Türkçe, Matematik, Fen, Sosyal, yabancı diller, fizik, kimya, …
- **Soru tipleri:** çoktan seçmeli, doğru/yanlış, boşluk doldurma, açık uçlu, eşleştirme, sıralama, matematik (LaTeX)
- **Kullanıcı profilleri** (öğretmen / öğrenci / veli) — tek tıkla geçiş
- **Sonuçlar ve raporlar**
- **İçe / dışa aktarma**
- **PWA:** ana ekrana ekle, çevrimdışı kullanım

## Yerel çalıştırma

```bash
npm install
npm run dev
```

## GitHub

Repo: [nrhtdmn/alistirma](https://github.com/nrhtdmn/alistirma)

```bash
npm run deploy
```

GitHub → Settings → Pages → Source: `gh-pages` dalı.

Canlı: https://nrhtdmn.github.io/alistirma/

## Kullanım kısaca

1. Soldan **aktif kullanıcı** seçin.
2. Bir klasöre girin → **+ Alt klasör** ile alt klasör ekleyin.
3. **Yeni içerik** veya **Kelime kartları** oluşturun.
4. **Çöz / Çalış** — sonuçlar kaydolur.
5. **Ayarlar → Dışa aktar** ile paylaşın.

## Teknik

- React + TypeScript + Vite
- Dexie (IndexedDB)
- KaTeX
- vite-plugin-pwa
- HashRouter (GitHub Pages uyumu)
