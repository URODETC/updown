# updown

Простой сайт для мониторинга VPN up/down по двум протоколам:

- **Xray + Reality**
- **AmneziaWG**

Отображаются:

- скорость скачивания (download)
- скорость отдачи (upload)
- ping
- потери пакетов
- графики по времени для обоих протоколов

## Запуск

```bash
cd /tmp/workspace/URODETC/updown
python3 -m http.server 8080
```

Откройте в браузере: `http://localhost:8080`.

## Настройка под ваши VPN

В файле `/tmp/workspace/URODETC/updown/app.js` замените URL в `PROTOCOLS`:

- `pingUrl` — endpoint для проверки доступности/задержки
- `downloadUrl` — endpoint для загрузки файла
- `uploadUrl` — endpoint для POST-запроса

Для корректных измерений endpoints должны быть доступны из браузера (CORS).