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

## Ce conține

- **Grafică 3D pixelată**: scena se randează la rezoluție mică și e mărită fără netezire, cu umbre dure și modele construite din voxeli (cuburi) cu ambient occlusion.
- **Cameră adaptivă**: vedere laterală clasică pe ecran orizontal, vedere 3/4 de sus pe ecran vertical.
- Cactuși 3D generați procedural (cu brațe și flori), pterodactili care bat din aripi la 3 înălțimi diferite.
- Deșert cu mesas, nori, tufișuri, praf la alergare, ciclu zi/noapte cu lună și stele.
- Sunete retro sintetizate (WebAudio), vibrație la impact.
- **PWA**: poate fi instalat pe ecranul principal al telefonului și merge offline.
- Fără build, fără dependențe externe la rulare: [three.js](https://threejs.org) r170 este inclus în `vendor/`.

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
vendor/               three.js (licență MIT)
```
