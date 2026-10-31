# Another Dino 🦖

Un endless runner **3D cu grafică pixelată (voxel)**, inspirat de dinozaurul din Chrome, gândit în primul rând pentru **telefoane**.

Aleargă prin **opt lumi**, sari peste cactuși, gropi, bolovani și meteoriți, ghemuiește-te sub pterodactili, strânge oase, cumpără skin-uri și animăluțe. Poți juca **în doi pe același ecran** sau **cu prietenii în LAN**, pe același Wi-Fi sau pe hotspot-ul unui telefon.

## Cum se joacă

| Telefon | Tastatură | Controller |
| --- | --- | --- |
| Atinge **partea dreaptă** → **sari** (ține apăsat ca să sari mai sus) | `Space` / `↑` / `W` | `A` / sus |
| Ține apăsat pe **partea stângă** sau **glisează în jos** → **ghemuit** (alunecare pe burtă) | `↓` / `S` | `B` / jos |
| În aer: **jos** → **aterizare în forță** (sparge obstacolele din față) | `↓` | `B` |
| În aer: **sari din nou și ține** → **planare** | `Space` | `A` |
| Butonul ⏸ → pauză | `P` / `Esc` | `Start` |

Tastele de săritură și ghemuit se pot schimba din Setări, iar zonele de atingere se pot inversa pentru stângaci. La primul joc, un tutorial scurt îți arată comenzile.

## Ce e în joc

- **8 lumi**, câte una la fiecare 1000 de puncte:
  - **deșert**: furtuni de nisip, tufișuri rostogolitoare;
  - **junglă**: ploaie;
  - **plajă**: ocean, castele de nisip;
  - **zăpadă**: oameni de zăpadă;
  - **peșteră**: întuneric, doar felinarul dinozaurului și cristale care strălucesc;
  - **oraș în ruine**;
  - **vulcan**: meteoriți;
  - **spațiu**: **gravitație mică**, Pământul pe cer.
- **Evenimente** în timpul turei: ploaie de meteoriți, un **T-rex uriaș** care te fugărește și **zona bonus** plină de oase.
- **Obstacole**: specifice fiecărei lumi, pterodactili la 3 înălțimi, bolovani, **gropi** și **meteoriți** cu cerc de avertizare.
- **Puteri speciale**: scut, magnet, încetinirea timpului, săritură dublă.
- **Upgrade-uri permanente**: puteri mai lungi, scut la start, oase duble, noroc.
- **A doua șansă**: când mori, continui o dată pentru 50 de oase.
- **Provocarea zilei**: un traseu nou în fiecare zi, cu țintă și recompensă. Dacă o termini zile la rând, recompensa crește.
- **Nivel de jucător (XP)**: la nivelurile 5, 10, 15 și 20 se deblochează skin-uri speciale (lavă, gheață, galaxie, curcubeu).
- **Magazin**: 8 skin-uri, 7 accesorii, **3 animăluțe** (puișor, broscuță țestoasă care aduce oase, pui de pterodactil care prinde oase) și **ou-surpriză**.
- **Misiuni** cu recompense, **26 de realizări**, **statistici** și un **top 10**.
- **Fantoma recordului**, care aleargă pe culoarul de lângă tine.
- **Distribuie recordul**: o imagine cu scorul tău.
  - pe Android se deschide meniul de partajare (WhatsApp, Telegram…);
  - pe PC se salvează în *Imagini* și se copiază, gata de lipit.
- **Efecte**: dinozaurul se sparge în cubulețe cu slow-motion, plus muzică chiptune diferită în fiecare lume.
- **Stiluri grafice**: Normal, Contur, Game Boy, Ecran CRT.
- **Confort și accesibilitate**: calitate grafică automată (scade singură pe telefoanele slabe), obstacole evidențiate, text mare.
- Interfață în **română, rusă și engleză**.

## 2 jucători pe același ecran

Din meniu alege **2 JUCĂTORI**. Ecranul se împarte în două: sus e jucătorul 1, jos jucătorul 2, pe același traseu.

- **PC**: jucătorul 1 folosește `W` / `S` (sau `Space`), jucătorul 2 folosește `↑` / `↓`. Primul controller conectat e al jucătorului 1, al doilea e al jucătorului 2.
- **Telefon/tabletă**: fiecare atinge jumătatea lui de ecran (stânga = ghemuit, dreapta = sari).

## Multiplayer LAN (fără internet)

Ca în Soul Knight: toți jucătorii sunt pe aceeași rețea, iar unul face pe gazda.

1. Conectați-vă toți la același **Wi-Fi**, sau pornește **hotspot-ul** pe un telefon și conectează-i pe ceilalți la el.
2. Deschideți **MULTIPLAYER**. Unul apasă **CREEAZĂ CAMERĂ**, iar ceilalți văd camera în listă și apasă **INTRĂ**. Dacă nu apare, merge și **Conectare după IP** (IP-ul gazdei e afișat în cameră).
3. Gazda apasă **START** (2–4 jucători). Toți aleargă pe **același traseu**, iar ceilalți se văd pe culoarele de alături, cu skin-ul și numele lor.
4. Câștigă cine rezistă cel mai mult. Gazda poate porni o cursă nouă cu **DIN NOU**.

Gazda alege și **modul**:

- **Cursă**: cine rezistă mai mult câștigă.
- **Sabotaj**: strângi bombe și trimiți bolovani pe traseul celorlalți (butonul **BOLOVAN**, tasta `E` sau `X` pe controller).
- **Eliminare**: viteza crește mult mai repede, iar ultimul rămas primește 100 de oase.

În cursă poți trimite **emoticoane** (butoanele 😂 🔥 👋 😱 sau tastele `1`–`4`). După ce ieși din cursă, camera îi urmărește pe cei rămași.

Merge între telefoane Android și PC-uri (Windows/macOS/Linux) amestecate. Funcționează doar în aplicații, nu în browser. Pe Windows, la prima cursă, permite accesul prin firewall în rețeaua privată. Comunicarea e directă, prin UDP pe portul **47777**.

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

**Actualizări dintr-o apăsare:** când apare o versiune nouă, în meniu apare **„Versiune nouă → ACTUALIZEAZĂ”**. Același buton e și în **Setări → Versiunea**. Apeși și restul se face singur:

| Sistem | Ce face butonul |
| --- | --- |
| Android | descarcă APK-ul și deschide instalarea; apeși **Actualizează** în fereastra Android (prima dată Android cere să permiți „Instalare aplicații” pentru joc) |
| Windows (installer) / Linux (AppImage) | descarcă, instalează și repornește jocul singur |
| Windows portabil | descarcă noul `.exe`, îl pune în locul celui vechi și repornește |
| macOS | descarcă `.dmg`-ul și îl deschide; tragi jocul în Applications (macOS nu permite mai mult aplicațiilor nesemnate) |

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

## Rulare locală

Orice server static merge, de exemplu:

```bash
python3 -m http.server 8000
```

apoi deschide `http://localhost:8000`. Pe telefon, din aceeași rețea Wi-Fi: `http://<ip-calculator>:8000`.
Pentru a testa multiplayer-ul fără aplicație, deschide `http://localhost:8000/?lantest` în două taburi ale aceluiași browser.

## Publicare pe GitHub Pages

GitHub Pages pe un repo privat cere un cont plătit. Pe un repo public e gratuit:

1. În repo: **Settings → Pages**.
2. La *Build and deployment* alege **Deploy from a branch**, branch-ul `main` și folderul `/ (root)`.
3. După un minut jocul e disponibil la `https://<utilizator>.github.io/Another-Dino/`.

Pe telefon, deschide link-ul și alege „Adaugă pe ecranul principal” pentru a-l avea ca aplicație full-screen.

## Structură

```
index.html            pagina + HUD
css/style.css         stiluri UI
js/main.js            bucla jocului, fizică, obstacole, puteri, input, cameră
js/biomes.js          cele 8 lumi: culori, obstacole și decor voxel
js/models.js          dino (skin-uri + accesorii), pterodactil, oase, puteri
js/voxel.js           mesher voxel (fețe vizibile + ambient occlusion)
js/effects.js         praf, spargerea în voxeli, vreme, stiluri grafice
js/music.js           muzica chiptune procedurală
js/audio.js           efecte sonore sintetizate
js/ui.js              meniuri, magazin, misiuni, statistici, setări, LAN
js/save.js            progresul salvat (oase, skin-uri, statistici, fantoma)
js/progress.js        upgrade-uri, nivel/XP, provocarea zilei, ou-surpriză
js/missions.js        misiuni și realizări
js/i18n.js            textele în română, rusă și engleză (cu pluralul corect)
js/net.js             transport UDP (Android / desktop / test în browser)
js/multiplayer.js     protocolul LAN: camere, lobby, cursă, rezultate
sw.js                 service worker pentru offline
vendor/               three.js (MIT), @capacitor/core (MIT), fontul Press Start 2P (OFL)
electron/             aplicația desktop (fereastră, UDP pentru LAN, actualizări)
capacitor.config.json aplicația Android
native/android/       activitate full-screen, plugin-uri (LAN, actualizare, distribuire), cheia de semnare
assets/, build/       iconițe și splash screen pentru aplicații
scripts/              build (copiază jocul în dist/) și pregătirea proiectului Android
```
