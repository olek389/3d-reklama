# OGNISKO – pandemia 1 na 1

Gra strategiczna na telefon dla dwóch osób. Jeden gracz jest **patogenem**, drugi **obrońcą** ludzkości. Każdy gra na swoim telefonie, w przeglądarce, przez internet.

Prototyp: czysty HTML/CSS/JS, bez budowania i bez własnego serwera.

## Zasady w skrócie

- **Patogen** wybiera region startowy i kupuje ulepszenia za punkty DNA (3 drzewka po 7: Przenoszenie, Objawy, Zdolności). Wygrywa, gdy zabije 60% ludzkości.
- **Obrońca** kupuje ulepszenia z budżetu (3 drzewka po 7: Medycyna, Kontrola, Wywiad), zamyka lotniska, porty i granice, wprowadza kwarantanny. Każde ograniczenie kosztuje zaufanie społeczne; przy niskim zaufaniu blokady są nieszczelne. Wygrywa, gdy ukończy lek, gdy patogen wygaśnie albo gdy minie czas.
- **Mgła wojny:** obrońca widzi tylko wykryte ogniska i nie zna cech patogenu bez Wywiadu. Patogen zna postęp leku tylko w przybliżeniu.
- 1 dzień gry = 0,5 s, limit 1500 dni (12,5 min).

## Jak zagrać we dwóch

1. Opublikuj stronę (np. GitHub Pages: Settings → Pages → wybierz gałąź i folder `/`).
2. Pierwszy gracz otwiera stronę, wybiera rolę i klika **Utwórz grę**. Dostaje 4-literowy kod.
3. Drugi gracz wpisuje kod (albo otwiera link z zaproszenia) i dostaje przeciwną rolę.

Telefon twórcy gry prowadzi symulację, więc nie może zamknąć strony. Gdy któryś telefon zgaśnie lub straci sieć, gra się wstrzymuje, a po powrocie rusza dalej.

Połączenie to WebRTC (biblioteka PeerJS w `vendor/`, publiczny serwer pośredniczący PeerJS tylko do zestawienia połączenia). W niektórych sieciach komórkowych bezpośrednie połączenie może się nie udać – wtedy pomaga Wi-Fi.

## Uruchomienie lokalne

```bash
python3 -m http.server 8000
```

- `http://localhost:8000/` – normalna gra.
- `http://localhost:8000/?local=1` – tryb testowy: dwie karty tej samej przeglądarki łączą się bez internetu.
- **Trening z botem** działa zawsze, bez sieci.

## Balans

```bash
npm run sim
```

Rozgrywa 200 partii bot kontra bot i wypisuje wynik. Wszystkie liczby balansu są w `CFG` w `js/game.js`, a ulepszenia w `js/data.js`.

## Pliki

| Plik | Rola |
| --- | --- |
| `js/data.js` | regiony, połączenia, ulepszenia |
| `js/game.js` | symulacja, akcje, widok gracza (mgła wojny) |
| `js/bot.js` | przeciwnik komputerowy |
| `js/net.js` | połączenie między telefonami |
| `js/ui.js`, `js/main.js` | interfejs i przebieg aplikacji |
