# Another Dino: documentație tehnică

Joc 3D în stil voxel, scris în JavaScript simplu (module ES, fără framework și fără bundler). Același cod rulează în browser, pe Android (Capacitor) și pe PC (Electron). Nu are server: progresul stă pe dispozitiv, multiplayerul merge prin UDP în rețeaua locală, iar transferul de progres se face prin QR, text sau Wi-Fi.

## Tehnologii

| Ce | Cu ce |
| --- | --- |
| Grafică 3D | three.js (`vendor/three.module.min.js`), modele generate din cod ca voxeli |
| Interfață | DOM simplu peste canvas (`index.html`, `css/style.css`, `js/ui.js`) |
| Sunet și muzică | WebAudio: efecte sintetizate și chiptune generat procedural, fără fișiere audio |
| Android | Capacitor 8 + plugin-uri Java proprii (`native/android/`) |
| PC | Electron 44 + electron-builder, actualizare cu electron-updater |
| Offline în browser | service worker (`sw.js`) |
| Build și release | GitHub Actions (`.github/workflows/build-apps.yml`) |

Modulele externe se încarcă printr-un import map din `index.html` (`three`, `@capacitor/core`, `qrcode`), așa că nu e nevoie de bundler.

## Pornire locală

```powershell
npm install
```
```powershell
npm start
```

`npm start` copiază jocul în `dist/` (`scripts/build.mjs`) și deschide aplicația Electron.

Pentru browser e suficient un server static în folderul proiectului. Atenție: pe Windows, `python -m http.server` trimite fișierele `.js` ca `text/plain`, iar modulele ES nu pornesc. Folosește un server care pune tipul corect, de exemplu `npx serve`.

| Comandă | Ce face |
| --- | --- |
| `npm run build` | Copiază fișierele jocului în `dist/` și verifică dacă `sw.js` cachează toate scripturile din `js/`. |
| `npm start` | Build și Electron. |
| `npm run dist:desktop` | Instalatorul și versiunea portabilă pentru sistemul curent (în `release/`). |
| `npm run android:prepare` | Proiectul Android: `cap add android`, plugin-uri, permisiuni, iconițe. |
| `npm run android:apk` | APK de debug. |

## Structura codului

```
index.html, css/style.css   pagina, HUD-ul și toate stilurile
js/main.js                  bucla jocului: fizică, obstacole, puteri, boși, moduri, input, cameră, LAN
js/ui.js                    toate meniurile și panourile (DOM)
js/i18n.js                  textele în română, rusă și engleză + pluralul
js/save.js                  profilul salvat în localStorage și valorile implicite
js/voxel.js                 mesher voxel: doar fețele vizibile, ambient occlusion
js/models.js                dino (skin-uri, pălării), pterodactil, oase, puteri
js/biomes.js                cele 13 lumi: culori, obstacole, decor apropiat și îndepărtat
js/bosses.js                boșii fiecărei lumi (model + fel de atac)
js/modes.js                 Aventura (niveluri, ordinea lumilor, Aventură+), robotul, regula zilei
js/music.js, js/audio.js    muzica procedurală, efectele sonore
js/effects.js, js/extras.js particule, vreme, stiluri grafice; licurici, platforme, osul de aur
js/progress.js, rewards.js  XP și niveluri, upgrade-uri, ouă, provocarea zilei; cufărul, pass-ul
js/missions.js, medals.js   misiuni, realizări, medalii
js/collection.js, pets.js   fosile, urme, evenimente de sezon; animăluțele care cresc
js/custom.js, editor.js     dansuri, teme de meniu, editorul de skin
js/levels.js, leveleditor.js traseele făcute de jucători (cod QR, stele, traseul săptămânii)
js/replay.js, gallery.js    reluarea ultimelor 10 secunde (GIF); albumul de poze (IndexedDB)
js/transfer.js              transferul de progres (QR, text, Wi-Fi cu PIN) și codurile de provocare
js/net.js, multiplayer.js   transportul UDP; protocolul LAN
js/controls.js              comenzile pe ecran și editorul lor
js/whatsnew.js              fereastra „Ce e nou”, câte o intrare pentru fiecare versiune
electron/                   procesul principal Electron: fereastra, UDP, actualizări
native/android/             plugin-uri Java: LAN, actualizări, share, widget
scripts/                    build-ul web și pregătirea proiectului Android
```

## Bucla jocului (`js/main.js`)

- `frame()` rulează la fiecare `requestAnimationFrame` și apelează `update(dt)` și `render()`.
- `update(dt)` mișcă jucătorii (gravitație 80, săritură 25, viteză de la 13 la 28), generează obstacolele, verifică coliziunile pe cutii, apoi actualizează evenimentele, boșii, LAN-ul și camera.
- **Starea jocului** e în `state`: `menu`, `countdown`, `running`, `paused`, `dying`, `revive`, `over`, `won`, `spectate`, `photo`.
- **Modul** e în `mode`: `solo`, `daily`, `zen`, `hardcore`, `adventure`, `bot`, `local`, `lan`, `challenge`, `custom`, `mutator`, `season`, `bossrush`. Regulile fiecăruia (reînviere, puteri, multiplicatorul de oase, misiuni, record) sunt în tabelul `RULES`.
- **Trasee identice:** obstacolele folosesc un generator cu sămânță (`R()`). Provocarea zilei, codurile QR, nivelurile din Aventură și cursele LAN dau astfel același traseu tuturor. Puterile și fosilele au generatorul lor (`IR()`), ca să nu schimbe obstacolele.
- **Lumea curentă:** `adv.world` în Aventură, lumea sezonului în tura sezonului, `rush.world` în Boss Rush, altfel `biomeAt(score)`, care trece prin lumi la fiecare 1000 de puncte (după 8000 intră și lumile din Aventură).
- **Boși:** `startBoss()` și `updateBoss()`. Un boss e o luptă de supraviețuire pe timp, iar atacul depinde de lume (`drop`, `roll`, `swim`). Bossul mic vine la fiecare 2000 de puncte. Bossul de echipă apare în co-op (LAN sau pe același ecran), iar în Boss Rush boșii vin unul după altul, în ordinea din `ADV_ORDER`.

## Lumile și ordinea lor

`BIOMES` din `js/biomes.js` e o listă. Indexul lumii în listă e și cheia sub care se salvează stelele (`profile.adventure["11-2"]` înseamnă lumea 11, nivelul 3). De aceea:

- lumile noi se adaugă **mereu la sfârșitul** listei, ca să nu se mute stelele salvate;
- ordinea de pe hartă și din poveste e separată, în `ADV_ORDER` (`js/modes.js`), iar lumea sezonului e mereu ultima;
- muzica unei lumi se caută după id, cu `songOf(id)` din `js/music.js`, nu după index. Pistele de meniu (11) și de boss (12) au numere fixe, pentru că alegerea din tonomat se salvează ca număr.

Pentru o lume nouă: o intrare în `BIOMES`, obstacole în `OBSTACLE_GEN`, decor în `NEAR_GEN` și `FAR_GEN`, culoarea fosilelor în `FOSSIL_TINT`, un boss în `BOSS_KIND` (plus pălăria lui în `HATS` cu `boss: '<id>'`), o melodie la sfârșitul lui `SONGS` și textele `biome_`, `story_` și `boss_` în toate cele 3 limbi.

## Date salvate (`js/save.js`)

- Totul stă în `localStorage`, la cheia `another-dino:profile`, ca JSON. Fantoma recordului are cheia ei, iar pozele stau în IndexedDB.
- `defaults()` descrie profilul complet. La încărcare, `sanitize()` completează câmpurile lipsă dintr-o versiune mai veche și repară tipurile greșite, așa că un câmp nou are nevoie doar de o valoare implicită.
- `SETTING_DEFAULTS` e folosit de butonul „Setări implicite”.

## Transferul de progres (`js/transfer.js`)

- Progresul se scrie ca text: `ANOTHERDINO;v=1;bones=540;xp=1903;...;sum=<fnv>`. Suma de control prinde codurile greșite.
- Statisticile se scriu ca listă de valori în ordinea din `STAT_KEYS`. **Cheile noi se adaugă doar la sfârșit**, ca să citească bine și codurile vechi.
- Același text merge ca cod QR (până la circa 1800 de caractere, altfel traseele proprii rămân pe dinafară), ca text copiat sau prin Wi-Fi (`LanSync`, cu PIN din 4 cifre, trimis în bucăți).
- La primire, `mergeProgress()` **unește** datele: maximul la numere, reuniunea la liste. Nu se pierde nimic de pe niciun dispozitiv.

## Multiplayer LAN

**Transport** (`js/net.js`): toate variantele au același API (`start`, `send`, `broadcast`, `addresses`, `stop`).

| Unde | Implementare |
| --- | --- |
| Android | plugin-ul Java `LanPlugin` (socket UDP) |
| PC | `dgram` din procesul principal Electron, prin `preload.cjs` |
| Test în browser | `?lantest` în adresă: tab-urile comunică printr-un `BroadcastChannel`. `&loss=0.2&dup=0.1&lag=150` simulează o rețea proastă. |

**Protocol** (`js/multiplayer.js`), pe portul UDP 47777, cu mesaje JSON:

- gazda trimite pe broadcast un anunț (`ad`) în fiecare secundă, iar cei care caută îl văd în lista de camere;
- clientul trimite `join`, iar gazda răspunde cu lobby-ul (`lobby`), unde intră jucătorii și modul;
- la START, gazda trimite de 3 ori `go` cu sămânța traseului, iar fiecare dispozitiv rulează același traseu local;
- în timpul cursei, fiecare trimite starea lui (`s`: scor, înălțime, ghemuit, viu) de circa 15 ori pe secundă. Gazda o retransmite tuturor (`all`, topologie stea), împreună cu inimile echipei;
- în co-op, o lovitură trimite `hit` cu o cheie unică (de 3 ori). Gazda numără fiecare cheie o singură dată, iar cifra ei e cea finală;
- când nu mai e nimeni în viață, gazda calculează rezultatele și trimite `end`. Ultimul rezultat se repetă și în lobby, pentru cine a pierdut pachetul.

Din v1.7 protocolul are versiunea 2 (`PROTO`): camerele vechi apar în listă ca „altă versiune” și nu se pot alege.

- fiecare jucător are un id fix (`profile.lanId`), așa că după o cădere de Wi-Fi gazda îl primește înapoi în aceeași cameră (și în cursa curentă, dacă era în ea). Clientul care nu mai aude gazda trimite `join` încă 15 secunde înainte să renunțe;
- cine intră în timpul cursei apare în lobby cu `late` și pornește la cursa următoare (`raceIds` ține cine aleargă acum);
- `go` și `all` duc și ordinea jucătorilor (`ord`, pentru echipe și ștafetă) și traseul din editor (`trk`), dacă gazda a ales unul;
- ștafeta: cine așteaptă trimite `w: 1`; când starea colegului dinainte devine `a: 0`, pornește de la scorul (`sc`) și viteza (`v`) lui;
- pe un traseu, cine trece linia de sosire trimite timpul (`ft`); rezultatele îi pun întâi pe cei care au terminat, după timp;
- cadourile (`gift`) au o cheie și se retrimit până vine confirmarea (`gack`); gazda le dă mai departe după câmpul `to`;
- handicapul (`hc`) se aplică doar pe dispozitivul jucătorului: lumea lui merge mai încet, dar scorul crește în același ritm.
- v1.8: spectatorii (`spec: 1` în `join`) nu intră în `ord`; orice dispozitiv care nu e în `ord` doar privește cursa și nu trimite stare;
- cupa (`bracket`): gazda ține perechile; după fiecare cursă `end` duce `cup` (perechi, câștigători, campion), iar lobby-ul duce tabloul curent. Cei eliminați nu mai sunt în `ord`;
- pachetul de trasee (`pack`) merge ca un cadou: cheie, retrimitere până la `gack`, maximum 20 de trasee;
- mesajele rapide (`qm`) duc doar numărul frazei (0–7), textul e tradus pe fiecare dispozitiv;
- titlul purtat (`ti`) merge în `join` și în lobby.

Protocolul suportă pachete pierdute, dublate și întârziate. Testul cu 3 jucători și 20% pierderi dă aceleași rezultate pe toate ecranele.

## Release și actualizări

- Fiecare push pe `main` pornește `build-apps.yml`: APK-ul Android, aplicațiile pentru Windows, macOS și Linux și un GitHub Release `v1.0.<numărul rulării>`.
- Aplicațiile compară versiunea lor cu ultimul release. Varianta Windows cu instalare și Android se actualizează din joc, iar varianta portabilă își înlocuiește singură exe-ul.
- Pentru fiecare versiune cu schimbări vizibile se adaugă o intrare **la începutul** listei `NEWS` din `js/whatsnew.js`, cu un id nou și textele în 3 limbi.
- La schimbarea fișierelor din `js/`, numărul cache-ului din `sw.js` crește (`another-dino-vNN`), ca browserul să ia versiunea nouă.

## Testare

`window.__dino` e un obiect de depanare, accesibil din consolă și din teste automate:

```js
__dino.startMode('bossrush');   // pornește orice mod
__dino.power.shield = 999;      // scut permanent
__dino.step(600);               // rulează 10 secunde de joc instant, fără să aștepte ecranul
__dino.score = 8000;            // sare direct la un scor
__dino.die();                   // termină tura
__dino.game.lan;                // sesiunea LAN curentă
```

`step(n)` face testele rapide și stabile: jocul avansează cadru cu cadru, chiar dacă fereastra e ascunsă sau lentă.

Ce a fost verificat pentru v1.6, în Chrome fără fereastră, comandat prin DevTools Protocol:

- toate modurile și nivelul cu boss din fiecare lume pornesc, rulează și se termină fără erori;
- interfața la 8 rezoluții, de la 320×568 la 1920×1080, inclusiv telefoane ținute orizontal;
- LAN cu 3 jucători în toate modurile, plus o rundă cu rețea proastă.

## Limite cunoscute

- Fără server: nu există salvare în cloud și nici clasament online.
- În browser nu merge multiplayerul LAN (lipsește accesul la UDP), cu excepția modului de test `?lantest`.
- Aplicațiile nu sunt semnate cu certificat plătit, așa că Windows și macOS afișează un avertisment la prima pornire.
