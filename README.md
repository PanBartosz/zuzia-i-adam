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
