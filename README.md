# Zuzia & Adam - aplikacja zdjęć weselnych

Responsywna aplikacja do zbierania zdjęć od gości i publikowania wybranej galerii po weselu.

## Funkcje

- publiczny upload zdjęć pod ukrytym tokenem QR,
- lokalny storage oryginałów, miniatur i wersji publikowanych,
- panel admina z blokadą uploadu i galerii,
- wybieranie, publikowanie, ukrywanie i odrzucanie zdjęć,
- kadrowanie wersji publikowanej,
- eksport oryginałów jako ZIP,
- generator QR dla uploadu i galerii.

## Widok gości

Strona ma jasny wygląd z delikatnymi zielonymi akcentami, nagłówek „Zuzanna & Adam”
i osobistą wiadomość od pary. Link do galerii otwiera od razu zakładkę galerii.
Przełączenie zakładek nie usuwa zdjęć wybranych do wysłania.

Formularz obsługuje dodawanie kolejnych plików, pomijanie powtórnego wyboru tego
samego pliku, postęp, zatrzymanie kolejki po bieżącym zdjęciu i ponawianie błędów.
Podgląd galerii ma strzałki, gest przesunięcia, Escape, zarządzanie fokusem oraz
pobieranie pojedynczego zdjęcia w JPG. Całą galerię lub zaznaczone zdjęcia można
pobrać jako ZIP z JPG. Goście otrzymują wyłącznie opublikowane, wykadrowane wersje.

Panel administracyjny pozwala zaznaczać oryginały do ZIP i przeglądać zdjęcia
bez otwierania kadrowania. Zapis kadru zachowuje dotychczasowy status publikacji;
publikacja jest osobną decyzją, a cofnięcie i ponowienie publikacji zachowuje kadr.
Galeria gości pobiera kolejne strony po 48 zdjęć. Panel admina renderuje po 48
miniatur, a eksport obejmuje także zdjęcia jeszcze niewyświetlone.

## Lokalny start

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Adresy po seedzie:

- gość: `http://localhost:3000/u/zuzia-adam-2026-wrzucamy`
- admin: `http://localhost:3000/admin`

Domyślne konto dev:

- e-mail: `admin@zuziaiadam.pl`
- hasło: `zmien-to-przed-weselem`

Przed publicznym użyciem zmień `AUTH_SECRET`, `ADMIN_PASSWORD`, tokeny i `APP_BASE_URL` w `.env`.

## Docker

```bash
docker compose up --build
```

W compose aplikacja zapisuje pliki w `./data`, a Postgres działa w osobnym wolumenie. Na hoście baza jest wystawiona na `localhost:55432`, żeby nie kolidować z lokalnym Postgresem na `5432`.

## Testowy serwer

Na serwerze testowym użyj obrazu z GHCR i osobnego compose:

```bash
docker compose -f docker-compose.test.yml up -d
```

Ten plik ma wpisane testowe wartości na sztywno i nie wymaga `.env` ani osobnego `Caddyfile`.
Wystawia aplikację na porcie `55321`, więc w Nginx Proxy Manager ustaw:

```text
Forward Hostname / IP: IP_SERWERA
Forward Port: 55321
Scheme: http
```

Wariant konfigurowalny przez `.env.server`:

```bash
cp .env.server.example .env.server
docker compose --env-file .env.server -f docker-compose.server.yml up -d
```

Zdjęcia będą zapisywane w `./data`, a baza w wolumenie `postgres-data`.
Wariant konfigurowalny też wystawia aplikację bezpośrednio na `APP_PORT`; reverse proxy/TLS robi Nginx Proxy Manager.

## GHCR

Workflow w `.github/workflows/ghcr.yml` buduje obraz po każdym pushu i publikuje go do:

```text
ghcr.io/panbartosz/zuzia-i-adam
```

Tag `latest` jest publikowany dla domyślnej gałęzi, a dodatkowo powstają tagi branch/sha.

## Struktura storage

```text
data/
  originals/   # prywatne oryginały
  thumbs/      # miniatury admina
  web/         # wersje robocze web
  published/   # wersje publicznej galerii
```

Zdjęcia nie są wkładane do `public/`; serwują je kontrolowane endpointy API.

## Weryfikacja

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Testy przeglądarkowe uruchamiaj na lokalnej bazie po migracji i seedzie:

```bash
npx playwright install chromium
npm run test:e2e
```

Wymagają działającego PostgreSQL, konfiguracji `.env` oraz programu `unzip`.
Playwright uruchamia serwer na `localhost:3000` lub wykorzystuje już działający.
Testy tworzą własne zdjęcia, tymczasowo otwierają dodawanie i galerię,
a na końcu usuwają swoje zdjęcia i przywracają poprzednie ustawienia.
Zrzuty ekranów i pobrane próbki trafiają do ignorowanego `output/playwright/`.
