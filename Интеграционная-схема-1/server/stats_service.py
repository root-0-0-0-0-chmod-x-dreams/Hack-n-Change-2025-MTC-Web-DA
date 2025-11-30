#!/usr/bin/env python3
"""
Stats Collector Service
Сервис для сбора статистики с социальных сетей (YouTube, Vk (soon)).
Работает как WSGI-приложение через Gunicorn или как standalone Flask-сервер.
"""

import json
import time
from datetime import datetime
from flask import Flask, request, Response
import requests

app = Flask(__name__)


def json_response(data, status_code=200):
    """Возвращает JSON-ответ с корректной кириллицей."""
    return Response(
        json.dumps(data, ensure_ascii=False),
        status=status_code,
        mimetype='application/json; charset=utf-8'
    )

# YouTube API ключ
#NOTE Получить ключ можно здесь https://developers.google.com/youtube/v3/getting-started
YT_API_KEY = "12345678910"


def iso_to_timestamp_ms(iso_string: str) -> int:
    """Конвертирует ISO 8601 дату в timestamp в миллисекундах."""
    try:
        dt = datetime.strptime(iso_string, "%Y-%m-%dT%H:%M:%SZ")
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def get_channel_id(channel_alias: str) -> str | None:
    """Получает channel_id по алиасу канала."""
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "type": "channel",
        "q": channel_alias,
        "key": YT_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        for item in data.get("items", []):
            if item.get("id", {}).get("kind") == "youtube#channel":
                return item["id"]["channelId"]
    except Exception as e:
        print(f"Error getting channel_id: {e}")
    
    return None


def get_uploads_playlist_id(channel_id: str) -> str | None:
    """Получает ID плейлиста с загрузками канала."""
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "part": "contentDetails",
        "id": channel_id,
        "key": YT_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        items = data.get("items", [])
        if items:
            return items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    except Exception as e:
        print(f"Error getting uploads playlist: {e}")
    
    return None


def get_video_list(playlist_id: str, max_results: int = 50) -> list:
    """Получает список видео из плейлиста."""
    url = "https://www.googleapis.com/youtube/v3/playlistItems"
    params = {
        "part": "contentDetails,snippet",
        "playlistId": playlist_id,
        "maxResults": max_results,
        "key": YT_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        return data.get("items", [])
    except Exception as e:
        print(f"Error getting video list: {e}")
    
    return []


def get_video_statistics(video_id: str) -> dict:
    """Получает статистику видео."""
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "statistics",
        "id": video_id,
        "key": YT_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        items = data.get("items", [])
        if items:
            return items[0].get("statistics", {})
    except Exception as e:
        print(f"Error getting video statistics: {e}")
    
    return {}


def get_video_comments(video_id: str, max_results: int = 100) -> list:
    """Получает комментарии к видео."""
    url = "https://www.googleapis.com/youtube/v3/commentThreads"
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": max_results,
        "order": "relevance",
        "key": YT_API_KEY
    }
    
    comments = []
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        for item in data.get("items", []):
            snippet = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
            comments.append({
                "textOriginal": snippet.get("textOriginal", ""),
                "likeCount": snippet.get("likeCount", 0),
                "updatedAt": snippet.get("updatedAt", "")
            })
    except Exception as e:
        # Комментарии могут быть отключены на видео
        print(f"Error getting comments for {video_id}: {e}")
    
    return comments


def collect_youtube_stats_sync(channel_alias: str) -> dict:
    """
    Синхронный сбор статистики YouTube канала.
    Возвращает готовый результат сразу.
    """
    # 1. Получаем channel_id
    channel_id = get_channel_id(channel_alias)
    if not channel_id:
        return {
            "records": [],
            "fieldKey": "name"
        }
    
    # 2. Получаем uploads playlist
    uploads_playlist_id = get_uploads_playlist_id(channel_id)
    if not uploads_playlist_id:
        return {
            "records": [],
            "fieldKey": "name"
        }
    
    # 3. Получаем список видео
    video_list = get_video_list(uploads_playlist_id)
    
    # 4. Для каждого видео собираем статистику и комментарии
    records = []
    for video in video_list:
        video_id = video.get("contentDetails", {}).get("videoId", "")
        snippet = video.get("snippet", {})
        content_details = video.get("contentDetails", {})
        
        if not video_id:
            continue
        
        # Получаем статистику
        stats = get_video_statistics(video_id)
        
        # Получаем комментарии
        comments = get_video_comments(video_id)
        
        # Формируем запись
        record = {
            "fields": {
                "Название видео": snippet.get("title", ""),
                "Ссылка": {
                    "title": f"https://www.youtube.com/watch?v={video_id}",
                    "text": f"https://www.youtube.com/watch?v={video_id}",
                    "favicon": ""
                },
                "Дата публикации": iso_to_timestamp_ms(content_details.get("videoPublishedAt", "")),
                "Кол-во просмотров": int(stats.get("viewCount", 0)),
                "Кол-во лайков": int(stats.get("likeCount", 0)),
                "Кол-во сохранений": int(stats.get("favoriteCount", 0)),
                "Кол-во комментариев": int(stats.get("commentCount", 0)),
                "JSON Массив комментариев": json.dumps(comments, ensure_ascii=False)
            }
        }
        records.append(record)
        
        # Небольшая задержка между запросами
        time.sleep(0.05)
    
    return {
        "records": records,
        "fieldKey": "name"
    }


@app.route("/stats/collect", methods=["POST"])
def collect_stats():
    """
    Синхронный эндпоинт для сбора статистики.
    Сразу возвращает готовый результат (без task_id и polling).
    
    Request body:
    {
        "source_type": "Youtube канал",
        "channel_alias": "MTSWebServices"
    }
    
    Response (готовый для записи в MWS Tables):
    {
        "status": "completed",
        "records": [...],
        "fieldKey": "name"
    }
    """
    try:
        data = request.get_json()
        
        source_type = data.get("source_type", "")
        channel_alias = data.get("channel_alias", "")
        
        if source_type == "Youtube канал":
            if not channel_alias:
                return json_response({
                    "records": [],
                    "fieldKey": "name"
                }, 400)
            
            # Синхронно собираем статистику и возвращаем результат
            result = collect_youtube_stats_sync(channel_alias)
            return json_response(result)
        
        # TODO: Добавить поддержку VK и других соцсетей
        return json_response({
            "records": [],
            "fieldKey": "name"
        }, 400)
        
    except Exception as e:
        return json_response({
            "records": [],
            "fieldKey": "name"
        }, 500)


@app.route("/stats/health", methods=["GET"])
def health_check():
    """Проверка здоровья сервиса."""
    return json_response({
        "status": "healthy",
        "service": "stats-collector",
        "timestamp": datetime.utcnow().isoformat()
    })


if __name__ == "__main__":
    # Для локальной разработки
    app.run(host="0.0.0.0", port=5000, debug=True)
