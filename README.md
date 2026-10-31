# Another Dino 🦖

Un endless runner **3D cu grafică pixelată (voxel)**, inspirat de dinozaurul din Chrome, gândit în primul rând pentru **telefoane**.

Aleargă prin patru lumi (deșert, junglă, zăpadă și vulcan), sari peste cactuși, gropi, bolovani și meteoriți, ghemuiește-te sub pterodactili, strânge oase și cumpără skin-uri. Poți juca și **cu prietenii în LAN**, pe același Wi-Fi sau pe hotspot-ul unui telefon.

## Cum se joacă

| Telefon | Tastatură | Controller |
| --- | --- | --- |
| Atinge **partea dreaptă** → **sari** (ține apăsat ca să sari mai sus) | `Space` / `↑` / `W` | `A` / sus |
| Ține apăsat pe **partea stângă** sau **glisează în jos** → **ghemuit** / cădere rapidă | `↓` / `S` | `B` / jos |
| Butonul ⏸ → pauză | `P` / `Esc` | `Start` |

În setări poți inversa zonele (pentru stângaci). La primul joc, un tutorial scurt îți arată comenzile.

## Ce e în joc

- **4 lumi** care se schimbă la fiecare 1000 de puncte: **deșert** (cactuși, tufișuri rostogolitoare, furtuni de nisip), **junglă** (trunchiuri, bambus, ploaie), **zăpadă** (țurțuri, oameni de zăpadă, ninsoare) și **vulcan** (obsidian, coloane de lavă, ploaie de meteoriți). Munții din fundal se scufundă și răsar în noua lume.
- **Obstacole**: cactuși și echivalentele lor din fiecare lume, pterodactili la 3 înălțimi, bolovani care se rostogolesc spre tine, **gropi** peste care trebuie să sari și **meteoriți** care cad din cer, cu un cerc roșu de avertizare pe jos.
- **Oase** de strâns (în linie sau în arc deasupra obstacolelor). Ele sunt moneda jocului.
- **Puteri speciale**: 🛡 **scut** (te salvează de o lovitură, chiar și dintr-o groapă), 🧲 **magnet** pentru oase, ⏳ **încetinirea timpului** și ⏫ **săritura dublă**.
- **Magazin**: 8 skin-uri (clasic, roșu, albastru, roz, auriu, umbră, schelet, robot) și 7 accesorii (coif de petrecere, pălărie de cowboy, ochelari de soare, joben, căști, coroană). Le vezi pe dino în 3D înainte să le cumperi.
- **Misiuni**: 3 active odată, cu recompense în oase, înlocuite cu altele mai grele când le termini. Plus **17 realizări**.
- **Statistici** (sărituri, distanță, timp de joc etc.) și **top 10** local.
- **Fantoma recordului**: un dino transparent care aleargă pe culoarul de lângă tine, exact cum ai jucat la record.
- **Efecte**: când te lovești, dinozaurul se sparge în cubulețe 3D, cu slow-motion. Mai sunt praf, ciclu zi/noapte, lună și stele.
- **Muzică chiptune** generată de joc, diferită în fiecare lume, care se grăbește odată cu viteza.
- **Stiluri grafice**: Normal, Contur, Game Boy (4 nuanțe de verde, cu dithering) și Ecran CRT.
- Interfață în **română, rusă și engleză** (automat după limba telefonului, sau la alegere din Setări).

## Multiplayer LAN (fără internet)

Ca în Soul Knight: toți jucătorii sunt pe aceeași rețea, iar unul face pe gazda.

1. Conectați-vă toți la același **Wi-Fi**, sau pornește **hotspot-ul** pe un telefon și conectează-i pe ceilalți la el.
2. Deschideți **MULTIPLAYER**. Unul apasă **CREEAZĂ CAMERĂ**, iar ceilalți văd camera în listă și apasă **INTRĂ**. Dacă nu apare, merge și **Conectare după IP** (IP-ul gazdei e afișat în cameră).
3. Gazda apasă **START** (2–4 jucători). Toți aleargă pe **același traseu**, iar ceilalți se văd pe culoarele de alături, cu skin-ul și numele lor.
4. Câștigă cine rezistă cel mai mult. Gazda poate porni o cursă nouă cu **DIN NOU**.

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
js/biomes.js          cele 4 lumi: culori, obstacole și decor voxel
js/models.js          dino (skin-uri + accesorii), pterodactil, oase, puteri
js/voxel.js           mesher voxel (fețe vizibile + ambient occlusion)
js/effects.js         praf, spargerea în voxeli, vreme, stiluri grafice
js/music.js           muzica chiptune procedurală
js/audio.js           efecte sonore sintetizate
js/ui.js              meniuri, magazin, misiuni, statistici, setări, LAN
js/save.js            progresul salvat (oase, skin-uri, statistici, fantoma)
js/missions.js        misiuni și realizări
js/i18n.js            textele în română, rusă și engleză (cu pluralul corect)
js/net.js             transport UDP (Android / desktop / test în browser)
js/multiplayer.js     protocolul LAN: camere, lobby, cursă, rezultate
sw.js                 service worker pentru offline
vendor/               three.js (MIT), @capacitor/core (MIT), fontul Press Start 2P (OFL)
electron/             aplicația desktop (fereastră, UDP pentru LAN, actualizări)
capacitor.config.json aplicația Android
native/android/       activitate full-screen, plugin UDP pentru LAN, cheia de semnare
assets/, build/       iconițe și splash screen pentru aplicații
scripts/              build (copiază jocul în dist/) și pregătirea proiectului Android
```
