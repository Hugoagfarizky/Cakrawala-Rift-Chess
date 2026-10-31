# Cakrawala: Rift Chess — Catur Taktis Dimensi Baru

**Cakrawala: Rift Chess** adalah game strategi berbasis giliran yang merombak aturan catur klasik menjadi pertempuran taktis penuh aksi. Berbeda dengan catur konvensional yang mana setiap tangkapan langsung mengeliminasi bidak dan setiap petak papan bersifat pasif, **Cakrawala** menghadirkan **Perisai Kristal**, **Penyerapan Jiwa Lawan**, **Petak Medan Elemen**, **Mantra Aether**, dan **Kabut Perang**.

---

## Fitur & Mekanik Utama

### 1. Sistem Perisai Kristal & Serangan Mental (*Shield Strike & Recoil*)
- Bidak berat (**Benteng**, **Menteri**, dan **Raja**) memulai permainan dengan **1 Perisai Kristal** (ditandai dengan indikator angka biru di sudut kanan atas bidak).
- Ketika bidak berperisai diserang oleh serangan biasa, bidak tersebut **tidak langsung gugur**:
  - Perisai akan pecah untuk menahan hantaman (`Perisai -1`).
  - Bidak penyerang akan **terpental kembali (*recoil*)** ke petak asalnya.
  - Penyerang tetap mendapatkan **+1 Energi Aether** atas keberhasilan menghancurkan perisai lawan.
- Serangan kedua terhadap bidak yang sudah kehilangan perisai baru akan menumbangkan bidak tersebut.

### 2. Penyerapan Jiwa Lawan (*Soul Absorption*)
Setiap bidak (selain Raja) yang berhasil menumbangkan bidak lawan untuk pertama kalinya akan menyerap **Jiwa** dari bidak yang dikalahkan dan berevolusi secara permanen:

| Bidak yang Dikalahkan | Jiwa yang Diserap | Simbol | Efek Evolusi pada Bidak Penyerang |
| :--- | :--- | :---: | :--- |
| **Kuda (*Knight*)** | **Jiwa Kuda** | `L` | Dapat ikut melompat membentuk huruf L seperti Kuda selain gerak aslinya. |
| **Gajah / Pion** | **Langkah Bayangan** | `P` | Dapat bergeser 1 petak ke segala arah (8 arah sekitar) seperti Raja. |
| **Benteng / Menteri** | **Tombak Bara** | `B` | Serangannya bersifat **Penembus (*Piercing*)**—langsung menghancurkan bidak berperisai dalam 1 serangan tanpa terpental! |

### 3. Petak Medan Elemen di Papan
Papan 8×8 memiliki petak elemen simetris di area tengah pertempuran:
- **Portal Rift ($\alpha$ & $\beta$)**: Sepasang portal dimensi. Bidak yang berhenti di `RIFT α` akan langsung berpindah (*teleport*) ke `RIFT β` jika petak tujuan sedang kosong (begitu pula sebaliknya).
- **Sumur Aether (`+AETHER`)**: Menghasilkan **+1 Energi Aether tambahan** setiap awal giliran selama dikuasai oleh bidak Anda, serta memberikan **+1 Perisai Kristal** saat pertama kali ditempati.
- **Hutan Lindung (`LINDUNG`)**: Melindungi bidak di dalamnya dari serangan jarak jauh. Lawan tidak dapat menangkap bidak di petak ini dari jarak lebih dari 2 petak.
- **Kawah Bara (`BARA`)**: Bidak apa pun yang melancarkan serangan dari atas petak ini mendapatkan efek **Serangan Penembus (*Piercing*)**, langsung mengeliminasi bidak berperisai dalam sekali serang.

### 4. Empat Mantra Aether (*Chrono & Rift Spells*)
Pemain mengumpulkan **Energi Aether** setiap giliran (+1 dasar tiap giliran, +1 per Sumur Aether yang dikuasai, dan +2 setiap menumbangkan lawan, maksimal 10 Aether). Mantra dapat diaktifkan **sebelum melangkah** tanpa menguras giliran gerak bidak:

1. **`[1]` Perisai Kristal (2 Aether)**: Memberikan +1 Perisai Kristal pada salah satu bidak kawan (maksimal 2 Perisai).
2. **`[2]` Bekukan Waktu (3 Aether)**: Membekukan 1 bidak lawan (selain Raja) selama 1 putaran penuh sehingga tidak dapat bergerak atau menyerang.
3. **`[3]` Tukar Kuantum (3 Aether)**: Menukar posisi 2 bidak kawan (selain Raja) di papan secara instan.
4. **`[4]` Gempa Cakrawala (4 Aether)**: Menggeser susunan petak elemen di baris tengah papan secara dinamis sekaligus memberikan +1 Perisai pada Raja Anda.

---

## Mode Permainan & Lawan

### 3 Mode Taktis
- **01. Cakrawala Rift**: Mode standar lengkap dengan Portal Rift, Sumur Aether, Hutan Lindung, Kawah Bara, Penyerapan Jiwa, dan 4 Mantra Aether.
- **02. Kabut Perang (*Fog of War*)**: Petak di luar jarak pandang bidak kawan diselimuti kabut gelap. Pergerakan lawan hanya terlihat jika masuk ke dalam radius pantauan bidak Anda atau berada di atas Sumur Aether.
- **03. Gempa Kuantum (*Quantum Shift*)**: Medan pertempuran hidup—setiap 4 putaran penuh, arus tektonik menggeser posisi petak elemen di tengah papan secara otomatis.

### Pilihan Lawan
- **AI Taktis (3 Tingkat Kesulitan)**:
  - **Pemula (*Novice*)**: AI bermain lebih santai untuk mempelajari mekanik elemen dan perisai.
  - **Taktisi (*Tactician*)**: AI mengevaluasi nilai perisai, petak elemen, dan aktif menggunakan Mantra Aether.
  - **Grandmaster**: AI memperhitungkan langkah balasan, mengincar Sumur Aether, dan mengombinasikan mantra dengan serangan penembus.
- **2 Pemain Lokal (*Pass & Play*)**: Bermain bergantian Putih dan Hitam dalam satu perangkat.

---

## Kontrol Permainan

| Input / Tombol | Fungsi |
| :--- | :--- |
| **Klik Kiri Mouse** | Memilih bidak, memilih petak tujuan, atau memilih target mantra |
| **`W` `A` `S` `D` / Tombol Panah** | Menggerakkan kursor petak di papan |
| **`Spasi` / `Enter`** | Memilih bidak / mengonfirmasi langkah pada kursor (atau memulai game di layar judul) |
| **`1` `2` `3` `4`** | Mengaktifkan atau membatalkan Mantra Aether 1–4 |
| **`M`** | Menyalakan / mematikan efek suara (*Mute / Unmute*) |
| **`Esc`** | Membatalkan pilihan mantra/bidak atau membuka menu Jeda (*Pause*) |

---

## Struktur Proyek

```text
├── index.html                  # Entry point HTML & konfigurasi font (Cinzel, Plus Jakarta Sans, JetBrains Mono)
├── metadata.json               # Metadata aplikasi
├── src/
│   ├── main.tsx                # Bootstrap React DOM
│   ├── App.tsx                 # Game Shell utama, HUD, pemilih mode, dan kontrol Mantra Aether
│   ├── index.css               # Konfigurasi Tailwind CSS v4 & variabel tipografi
│   ├── components/
│   │   └── RiftBoardCanvas.tsx # Renderer HTML5 Canvas 60fps, efek partikel, hitstop, & telegraf serangan AI
│   └── game/
│       ├── types.ts            # Definisi tipe data bidak, jiwa, petak elemen, dan mantra
│       ├── engine.ts           # Logika aturan gerak, perisai, portal rift, Fog of War, dan evaluasi AI
│       └── sound.ts            # Synthesizer efek suara prosedural berbasis Web Audio API
```

---

## Cara Menjalankan Secara Lokal

1. Instal dependensi:
   ```bash
   npm install
   ```
2. Jalankan server pengembangan (port 3000):
   ```bash
   npm run dev
   ```
3. Bangun untuk produksi:
   ```bash
   npm run build
   ```
