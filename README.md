# Wa-Baileys

**Wa-Baileys** adalah bot WhatsApp yang dibangun menggunakan [Baileys](https://github.com/WhiskeySockets/Baileys), sebuah library WhatsApp Web API untuk Node.js. Bot ini menyediakan berbagai fitur otomatisasi dan respons interaktif di WhatsApp.

## Fitur

- **Mengirim Pesan Otomatis**: Mengirim pesan otomatis berdasarkan perintah atau waktu yang ditentukan.
- **Fitur Bot Tambahan**: Tambahkan fitur lain seperti pengingat, pengingat salat, dan lainnya.
- **Downloader**: Download media dari Sosial Media.
- **Perintah Kustom**: Buat dan atur perintah khusus sesuai kebutuhan.

## Prasyarat

Sebelum memulai, pastikan Anda telah menginstal perangkat lunak berikut:

- **Node.js** (versi 16 atau lebih baru)
- **pnpm** (Package Manager)

## Instalasi

1. **Clone repositori ini**:

   ```bash
   git clone https://github.com/vallken/Wa-Baileys.git
   cd Wa-Baileys
   ```

2. **Instal dependensi**:

   ```bash
   pnpm install
   ```

3. **Konfigurasi variabel lingkungan**:

   Buat file `.env` di root proyek dan tambahkan variabel-variabel berikut:

   ```bash
   MONGO_URI=your_mongodb_uri
   GEMINI_API_KEY=your_gemini_api_key
   REMOVE_URI=your_removeBg_api_key
   ```

   - `REMOVE_URI`: Api Key untuk layanan remove.bg
   - `MONGO_URI`: URI MongoDB untuk menyimpan data pengguna dan konfigurasi bot.
   - `GEMINI_API_KEY`: API key untuk layanan eksternal jika diperlukan.

4. **Jalankan bot**:

   ```bash
   pnpm start
   ```

   Bot akan mulai berjalan dan Anda akan melihat kode QR di terminal untuk dipindai dengan aplikasi WhatsApp Anda.

## Penggunaan

- **Scan QR Code**: Pindai kode QR yang muncul di terminal menggunakan aplikasi WhatsApp Anda.
- **Tambah Perintah Baru**: Untuk menambahkan perintah baru, edit file di folder `plugin` sesuai dengan struktur yang ada.
- **Mengatur Jadwal Pesan**: Gunakan file konfigurasi atau perintah bot untuk mengatur jadwal pengiriman pesan otomatis.

## Kontribusi

Kami menerima kontribusi dari siapa saja. Jika Anda ingin menambahkan fitur atau memperbaiki bug, silakan fork repositori ini dan kirim pull request.

1. Fork repositori ini.
2. Buat branch fitur Anda (`git checkout -b fitur-anda`).
3. Commit perubahan Anda (`git commit -m 'Menambahkan fitur A'`).
4. Push ke branch tersebut (`git push origin fitur-anda`).
5. Buat pull request di GitHub.

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

## Kontak

Untuk pertanyaan atau diskusi lebih lanjut, Anda dapat membuka [Issue di GitHub](https://github.com/vallken/Wa-Baileys/issues).

