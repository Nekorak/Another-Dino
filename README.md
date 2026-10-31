# Another Dino 🦖

Un endless runner **3D cu grafică pixelată (voxel)**, inspirat de dinozaurul din Chrome, gândit în primul rând pentru **telefoane**.

Sari peste cactuși, ghemuiește-te sub pterodactili și vezi cât de departe ajungi. Viteza crește treptat, iar la fiecare 700 de puncte se face noapte.

## Cum se joacă

| Telefon | Tastatură |
| --- | --- |
| Atinge **partea dreaptă** a ecranului → **sari** (ține apăsat ca să sari mai sus) | `Space` / `↑` / `W` → sari |
| Ține apăsat pe **partea stângă** sau **glisează în jos** → **ghemuit** / cădere rapidă | `↓` / `S` → ghemuit |
| Butonul ⏸ → pauză | `P` / `Esc` → pauză |

Butoanele din colțul stânga-sus: pauză, sunet, mărimea pixelilor (`PX1`–`PX3`) și ecran complet.
Recordul (HI) se salvează în browser.

## Aplicații (Android, Windows, macOS, Linux)

Jocul există și ca aplicație normală, nu doar în browser. Ultima versiune se descarcă de la
**[Releases](https://github.com/Nekorak/Another-Dino/releases/latest)**:

| Sistem | Fișier | Instalare |
| --- | --- | --- |
| Android | `Another-Dino-android.apk` | Deschide APK-ul pe telefon și permite „instalare din surse necunoscute”. |
| Windows | `Another-Dino-win-x64.exe` | Installer. Dacă apare „Windows protected your PC”: *More info → Run anyway*. |
| Windows | `Another-Dino-windows-portable.exe` | Rulează direct, fără instalare. |
| macOS | `Another-Dino-mac-arm64.dmg` / `-x64.dmg` | arm64 pentru Apple M1/M2/M3…, x64 pentru Intel. Prima dată: click-dreapta → *Open*. |
| Linux | `Another-Dino-linux-x86_64.AppImage` | `chmod +x` și rulează. |

Aplicațiile merg complet offline. Pe desktop, `F11` (sau `Alt+Enter`) comută ecranul complet.
Pe Android jocul rulează pe tot ecranul și ecranul nu se stinge cât joci.

Aplicațiile sunt construite automat de GitHub Actions (`.github/workflows/build-apps.yml`) la fiecare push:
Android cu [Capacitor](https://capacitorjs.com), desktop cu [Electron](https://www.electronjs.org).
APK-ul e semnat mereu cu aceeași cheie (`native/android/debug.keystore`), ca versiunile noi să se instaleze peste cele vechi;
pentru Google Play ar fi nevoie de o cheie de release separată.

**iPhone:** Apple nu permite instalarea aplicațiilor din afara App Store fără cont de dezvoltator plătit.
Pe iPhone deschide versiunea web în Safari și alege *Share → Add to Home Screen*: se deschide pe tot ecranul, ca o aplicație.

### Construire locală

```bash
npm ci
npm start              # pornește aplicația desktop
npm run dist:desktop   # creează installerul pentru sistemul curent în release/
npm run android:apk    # creează APK-ul (necesită Android SDK și Java 21)
```

## Ce conține

- **Grafică 3D pixelată**: scena se randează la rezoluție mică și e mărită fără netezire, cu umbre dure și modele construite din voxeli (cuburi) cu ambient occlusion.
- **Cameră adaptivă**: vedere laterală clasică pe ecran orizontal, vedere 3/4 de sus pe ecran vertical.
- Cactuși 3D generați procedural (cu brațe și flori), pterodactili care bat din aripi la 3 înălțimi diferite.
- Deșert cu mesas, nori, tufișuri, praf la alergare, ciclu zi/noapte cu lună și stele.
- Sunete retro sintetizate (WebAudio), vibrație la impact.
- **PWA**: poate fi instalat pe ecranul principal al telefonului și merge offline.
- Versiunea web nu are nevoie de build: [three.js](https://threejs.org) r170 și fontul Press Start 2P sunt incluse în `vendor/`.

## Rulare locală

Orice server static merge, de exemplu:

```bash
python3 -m http.server 8000
```

apoi deschide `http://localhost:8000`. Pe telefon, din aceeași rețea Wi-Fi: `http://<ip-calculator>:8000`.

## Publicare pe GitHub Pages

1. În repo: **Settings → Pages**.
2. La *Build and deployment* alege **Deploy from a branch**, branch-ul `main` și folderul `/ (root)`.
3. După un minut jocul e disponibil la `https://<utilizator>.github.io/Another-Dino/`.

Pe telefon, deschide link-ul și alege „Adaugă pe ecranul principal” pentru a-l avea ca aplicație full-screen.

## Structură

```
index.html            pagina + HUD
css/style.css         stiluri UI
js/main.js            bucla jocului, fizică, input, cameră, scenă
js/models.js          modelele voxel (dino, cactuși, pterodactil, decor)
js/voxel.js           mesher voxel (fețe vizibile + ambient occlusion)
js/audio.js           efecte sonore sintetizate
sw.js                 service worker pentru offline
vendor/               three.js (MIT) și fontul Press Start 2P (OFL)
electron/main.cjs     aplicația desktop
capacitor.config.json aplicația Android
native/android/       activitate full-screen + cheia de semnare a APK-ului
assets/, build/       iconițe și splash screen pentru aplicații
scripts/              build (copiază jocul în dist/) și pregătirea proiectului Android
```
