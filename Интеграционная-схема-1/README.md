
## Импорт данных из ютуб канала (интегральная схема для MWS Tables)
> Сервис для сбора статистики с социальных сетей (YouTube, VK (скоро))

Полную конфигурацию можно посмотреть в файле **Импорт данных из ютьюб канала.json**

> [!NOTE] 
> Для работы схемы сначала необходимо запустить бекэнд, поэтому перед запуском схемы не забудьте прочитать (Интеграционная-схема-1/server/DEPLOY.md). 

### Как работает схема?

#### 1. Объявление констант 
В певром "кубе" задаются константы, например:
```json
{"API_KEY":"uskJLBRU4KQNA3gCDmlSaCT","HOST":"https://tables.mws.ru","SERVER_URL":"https://example.ru/stats","SOURCE_TABLE":{"DST_ID":"dstqvP2cewnU599XuC","VIEW_ID":"viww2SGAriYPf"},"RESULT_TABLE":{"DST_ID":"dstjtTTLuHmAnewaEu"}}
```
> [!NOTE] 
> В данном случае https://example.ru/stats это заглушка для домена вашего сервера, в реальном использовании замените на свой домен. Также не забудьте указать нужные id таблиц MWS Tables

#### 2. Запрос к таблице источников данных

Так выглядит запрос:
```bash
curl "jp{HOST}/fusion/v1/datasheets/jp{SOURCE_TABLE.DST_ID}/records?viewId=jp{SOURCE_TABLE.VIEW_ID}&fieldKey=name" \
  -H "Authorization: Bearer jp{API_KEY}"
```
Пример ответа есть в Интеграционная-схема-1/Примеры-запросов-ответов/source_table_scheme.json

#### 3. Извлечение youtube_channel из records
Здесь главную функцию выполняет этот скрипт на Lua
```Lua
"lua{for _, record in ipairs(records) do local name = record.fields['Название'] if name == 'Youtube канал' then local url = record.fields.URL if url and url.text then return string.match(url.text, '@([^/]+)') end end end return nil}lua
```

Скрипт ищет в поле "Название" значение "Youtube канал". Если такое название есть, то в поле URL скрипт ищет алиас (id) канала, которое затем присваивается переменной "youtube_channel". В том случае если название не указано, переменная "youtube_channel" будет иметь значение nil, в что будет равносильно сбору статистике из текущих рекомендаций ютуба.

#### 4. POST запрос на example.ru для сбора статистики (синхронный)

```bash
# Адрес:
jp{SERVER_URL}/collect
# Тело 
{"source_type": "Youtube канал", "channel_alias": "jp{youtube_channel}"}
{"Content-Type":"application/json"}
```
Интеграционная-схема-1/Примеры-запросов-ответов/yt-requests-task.md


#### 5. POST запрос к таблице результатов для записи статистики

Пример запроса:

```bash
curl -X POST "jp{HOST}/fusion/v1/datasheets/jp{RESULT_TABLE.DST_ID}/records?viewId=viwyY16CkNdiP&fieldKey=name"  \
  -H "Authorization: Bearer jp{API_KEY}" \
  -H "Content-Type: application/json" \
  --data '{
  "records": [
  {
    "fields": {
      "Название видео": "Как навести порядок в ИТ‑инфраструктуре с командой профессиональных сервисов | Павел Брагин",
      "Ссылка": {
        "title": "https://www.youtube.com/watch?v=1iGI1ddE1bE",
        "text": "https://www.youtube.com/watch?v=1iGI1ddE1bE",
        "favicon": ""
      },
      "Дата публикации": 1763005680000,
      "Кол-во просмотров": 22,
      "Кол-во лайков": 0,
      "Кол-во сохранений": 0,
      "Кол-во комментариев": 0,
      "JSON Массив комментариев": "{}"
    }
  }
],
  "fieldKey": "name"
}'

```