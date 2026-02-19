# 🕌 Jadwal Ramadan 2026 (PWA) — MrD4x

Website jadwal Ramadan berbasis **Progressive Web App (PWA)** yang menampilkan jadwal **Imsak & Sholat 5 waktu**, dilengkapi **Adzan otomatis**, **pengingat sahur**, **progress bar menuju berbuka**, serta bisa di-install seperti aplikasi di HP/PC.

🌐 Demo: https://davidagusk.github.io/ramadhan/

---

## ✨ Fitur Utama

* 📅 Jadwal Ramadan 30 hari (mulai 19 Februari 2026)
* 🧭 Auto lokasi GPS (deteksi kota otomatis)
* 🕌 Jadwal:

  * Imsak
  * Subuh (adzan khusus)
  * Dzuhur
  * Ashar
  * Maghrib
  * Isya
* 🔊 Adzan otomatis 5 waktu
* ⏰ Pengingat sahur (30 menit sebelum imsak)
* 📊 Progress bar menuju berbuka / menuju imsak
* 🔔 Notifikasi popup & sistem browser
* 📥 Export tabel ke PNG
* 📱 Install ke HP / Desktop (PWA)
* 🌙 Tampilan glass UI modern & responsive

---

## 📲 Install Aplikasi

### Android (Chrome)

Buka website → tekan **⋮ menu → Install App / Tambahkan ke layar utama**

### iPhone (Safari)

Buka website → Share → **Add to Home Screen**

### Desktop (Chrome / Edge)

Klik ikon install di address bar

---

## 🛠️ Teknologi

* HTML5 + CSS3 (Glass UI)
* Vanilla JavaScript
* Service Worker (Offline cache)
* Web App Manifest
* Notification API
* Geolocation API
* html2canvas (Export PNG)
* API Jadwal Sholat: https://api.myquran.com

---

## 📂 Struktur File

```
ramadhan/
│── index.html
│── main.js
│── style.css
│── manifest.webmanifest
│── sw.js
│── adzan.mp3
│── subuh.mp3
│── imsak.mp3
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── maskable-192.png
    └── maskable-512.png
```

---

## ⚠️ Catatan

* Browser akan meminta interaksi user sekali sebelum audio adzan bisa diputar (aturan autoplay browser)
* GPS membutuhkan HTTPS (GitHub Pages sudah mendukung)
* Jadwal diambil langsung dari API myQuran (real-time)

---

## 👨‍💻 Author

**MrD4x**

---

## 📜 License

Free to use for learning & dakwah purposes 🤲
