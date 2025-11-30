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
