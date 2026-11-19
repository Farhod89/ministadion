# 🏟 MiniStadion.uz — Ўрнатиш йўриқномаси
## Республика бўйича мини стадионлар платформаси

---

## 📋 Тузилма

```
platform/
├── index.html      — Асосий сайт (Яндекс Харита + стадионлар рўйхати)
├── stadium.html    — Алоҳида стадион: жадвал, буюртма, чат, live board
├── Code.gs         — Google Apps Script backend API
└── ORNATISH.md     — Ушбу йўриқнома
```

---

## 1️⃣ GOOGLE SHEETS ЯРАТИШ

1. **Google Drive** га кинг → `+Янги` → `Google Sheets` → `Бўш жадвал`
2. Жадвал номини беринг: `MiniStadion Database`
3. Жадвал очиқ турганда **URL дан ID ни олинг:**
   ```
   https://docs.google.com/spreadsheets/d/XXXX_SHEET_ID_XXXX/edit
   ```
   `XXXX_SHEET_ID_XXXX` — сизга керакли ID

---

## 2️⃣ GOOGLE APPS SCRIPT ДЕПЛОЙ

### Apps Script яратиш
1. Google Sheets ичида: `Кенгайтиришлар` → `Apps Script`
2. `Code.gs` файлини очинг
3. Мавжуд кодни **тўлиқ ўчиринг**
4. `Code.gs` файлидаги кодни **нусхалаб ёпиштиринг**
5. `Ctrl+S` билан сақланг

### Биринчи созлаш (Setup)
1. Функция рўйхатида `setup` ни танланг
2. ▶️ Ишга тушириш тугмасини босинг
3. Рухсат сўралади → `Рухсат бериш` → Google аккаунтингиз

**Console'да чиқадиган маълумотни сақланг:**
```
Setup complete. SHEET_ID: 1abc...xyz
Admin key: admin_a1b2c3d4
```

### Web App сифатида деплой
1. `Деплой` → `Янги деплой`
2. Тури: **Веб-илова**
3. Созламалар:
   - **Ким сифатида ишлайди:** `Men`
   - **Кимга рухсат:** `Hamma (anonim ham)` ✅
4. `Деплой` → URLни нусхалаб олинг:
   ```
   https://script.google.com/macros/s/YOUR_ID_HERE/exec
   ```

---

## 3️⃣ TELEGRAM BOT (ИХТИЁРИЙ)

Стадион эгаларига буюртма хабарлари учун:

1. Telegram'да `@BotFather` → `/newbot`
2. Бот номи ва username беринг
3. **Token** ни нусхалаб олинг: `12345:ABCdef...`

4. Apps Script → `Лойиҳа созламалари` → `Скрипт хусусиятлари`:
   ```
   TELEGRAM_TOKEN = 12345:ABCdef...
   ADMIN_TELEGRAM_ID = сизнинг Telegram ID (рақам)
   ```

**Telegram ID олиш:** `@userinfobot` га `/start` юборинг

---

## 4️⃣ ЯНДЕКС ХАРИТА API КАЛИТИ

1. [developer.tech.yandex.ru](https://developer.tech.yandex.ru) га ўтинг
2. `API ключлари` → `Яндекс Харита API` → `Яратиш`
3. Домен қўшинг ёки `localhost` учун `*` қўйинг
4. API калитни нусхалаб олинг: `a1b2c3d4-...`

---

## 5️⃣ FRONTEND СОЗЛАШ

### index.html ва stadium.html да ўзгартириш

Ҳар иккала файлда қуйидаги 2 жойни ўзгартиринг:

```javascript
// УШБУ САТРЛАРНИ ТОПИНГ ВА АЛМАШТИРИНГ:
var API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
var YANDEX_API_KEY = 'YOUR_YANDEX_MAPS_API_KEY';
```

```html
<!-- HTML охиридаги script тегни ҳам -->
<script src="https://api-maps.yandex.ru/2.1/?apikey=YOUR_YANDEX_MAPS_API_KEY&lang=uz_UZ&onload=ymapsReady" async></script>
```

---

## 6️⃣ ХОСТИНГ (САЙТНИ ИНТЕРНЕТГА ЧИҚАРИШ)

### Вариант А: GitHub Pages (бепул)
1. GitHub'да янги репозиторий яратинг
2. Файлларни юкланг (HTML файллар)
3. Settings → Pages → Source: `main` branch
4. Сайт манзили: `https://yourusername.github.io/stadium/`

### Вариант Б: Netlify (бепул, осон)
1. [netlify.com](https://netlify.com) га кинг
2. `Add new site` → `Deploy manually`
3. HTML файлларни торт-ташланг
4. Автоматик URL берилади

### Вариант В: XAMPP (локал тест учун)
1. HTML файлларни `C:\xampp\htdocs\stadium\` га кўчиринг
2. `http://localhost/stadium/` да очинг

---

## 7️⃣ СТАДИОН QO'SHISH (ТЕСТ)

### Admin орқали тасдиқлаш
Стадион рўйхатдан ўтгач, adminга Telegram хабар боради.
Тасдиқлаш учун API ни тўғридан чақириш:

```
POST https://script.google.com/macros/s/YOUR_ID/exec

{
  "action": "confirm_stadium",
  "stadium_id": "abc123",
  "admin_key": "admin_a1b2c3d4"  ← setup'да олинган
}
```

### Curl орқали (terminal):
```bash
curl -X POST "https://script.google.com/macros/s/YOUR_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{"action":"confirm_stadium","stadium_id":"abc123","admin_key":"admin_xxxx"}'
```

---

## 8️⃣ TEST МАЪЛУМОТЛАР ҚЎШИШ

Google Sheets `Stadiums` варағига вақтинча қуйидагини қўшинг:

| id | name | lat | lng | region | confirmed |
|----|------|-----|-----|--------|-----------|
| test1 | Yoshlar Stadioni | 41.2995 | 69.2401 | Toshkent | confirmed |
| test2 | Samarqand Mini | 39.6542 | 66.9597 | Samarqand | confirmed |

---

## 9️⃣ ХАТОЛАРНИ ТЕКШИРИШ

### Apps Script логлари
`Apps Script` → `Ижро` → `Журнал записи`

### CORS хатоси
Apps Script Web App'и `Who has access: Anyone` бўлиши шарт.

### JSON хатоси
Console'да `F12` → Network вкладкасида API жавобини кўринг.

---

## 🔑 МУҲИМ ЭСЛАТМАЛАР

- `Admin key` ни хавфсиз жойда сақланг (ҳеч кимга берманг)
- Стадион эгаси панелига кириш: **фақат телефон рақами** орқали
- Буюртма тасдиқлаш/рад этиш: стадион эгаси панелидан
- Ҳисоб киритиш: стадион эгаси панели → тасдиқланган буюртмалар

---

## 📊 GOOGLE SHEETS СТРУКТУРАСИ

### Stadiums варағи
`id | name | owner_name | owner_phone | telegram_id | lat | lng | region | address | working_hours | capacity | price_per_hour | description | confirmed | created_at`

### Bookings варағи
`id | stadium_id | user_phone | user_name | booking_date | start_time | end_time | team1 | team2 | booking_type | status | score1 | score2 | notes | created_at`

### Users варағи
`id | full_name | phone | telegram_username | telegram_id | region | created_at`

### Chat варағи
`id | stadium_id | user_name | user_phone | message | created_at`
