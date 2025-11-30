// youtube-data-collector.js
const YOUTUBE_API_KEY = 'AIzaSyBAQ9UX6VOmyRM0etil4ycMlsSAOz4MyTI';
const CHANNEL_QUERY = '@MTSWebServices';
const MAX_COMMENTS = 100;

class YouTubeDataCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
  }

  async fetchJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  async getChannelId(query) {
    const url = `${this.baseURL}/search?type=channel&q=${encodeURIComponent(query)}&key=${this.apiKey}`;
    console.log('Шаг 1: Получаем channelId...');
    
    const data = await this.fetchJSON(url);
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Канал не найден');
    }
    
    const channelId = data.items[0].id.channelId;
    console.log(`✓ channelId: ${channelId}`);
    return channelId;
  }

  async getUploadsPlaylistId(channelId) {
    const url = `${this.baseURL}/channels?part=contentDetails&id=${channelId}&key=${this.apiKey}`;
    console.log('Шаг 2: Получаем uploadsPlaylistId...');
    
    const data = await this.fetchJSON(url);
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Данные канала не найдены');
    }
    
    const uploadsPlaylistId = data.items[0].contentDetails.relatedPlaylists.uploads;
    console.log(`✓ uploadsPlaylistId: ${uploadsPlaylistId}`);
    return uploadsPlaylistId;
  }

  async getPlaylistVideos(playlistId, maxResults = 50) {
    const url = `${this.baseURL}/playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${this.apiKey}`;
    console.log(`Шаг 3: Получаем список видео (максимум ${maxResults})...`);
    
    const data = await this.fetchJSON(url);
    
    if (!data.items || data.items.length === 0) {
      return [];
    }

    const videos = data.items.map(item => ({
      publishedAt: item.snippet.publishedAt,
      title: item.snippet.title,
      description: item.snippet.description,
      videoId: item.contentDetails.videoId,
      videoPublishedAt: item.contentDetails.videoPublishedAt
    }));

    console.log(`✓ Найдено ${videos.length} видео`);
    return videos;
  }

  async getVideoStatistics(videoId) {
    const url = `${this.baseURL}/videos?part=statistics&id=${videoId}&key=${this.apiKey}`;
    
    const data = await this.fetchJSON(url);
    
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const stats = data.items[0].statistics;
    return {
      viewCount: parseInt(stats.viewCount) || 0,
      likeCount: parseInt(stats.likeCount) || 0,
      favoriteCount: parseInt(stats.favoriteCount) || 0,
      commentCount: parseInt(stats.commentCount) || 0
    };
  }

  async getVideoComments(videoId, maxResults = 100) {
    const url = `${this.baseURL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${this.apiKey}`;
    
    try {
      const data = await this.fetchJSON(url);
      
      if (!data.items || data.items.length === 0) {
        return [];
      }

      const comments = data.items.map(item => ({
        textOriginal: item.snippet.topLevelComment.snippet.textOriginal,
        likeCount: parseInt(item.snippet.topLevelComment.snippet.likeCount) || 0,
        updatedAt: item.snippet.topLevelComment.snippet.updatedAt
      }));

      return comments;
    } catch (error) {
      console.log(`  ⚠ Не удалось получить комментарии для видео ${videoId}`);
      return [];
    }
  }

  async collectAllData(channelQuery, maxVideos = 50, maxComments = 100) {
    console.log('=== Начинаем сбор данных YouTube ===\n');
    
    try {
      const channelId = await this.getChannelId(channelQuery);
      const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
      const videos = await this.getPlaylistVideos(uploadsPlaylistId, maxVideos);
      
      console.log('\nШаг 4-5: Собираем статистику и комментарии для каждого видео...');
      
      const enrichedVideos = [];
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        console.log(`\n[${i + 1}/${videos.length}] Обрабатываем: ${video.title}`);
        
        const statistics = await this.getVideoStatistics(video.videoId);
        const comments = await this.getVideoComments(video.videoId, maxComments);
        console.log(`  ✓ Статистика получена. Комментариев: ${comments.length}`);
        
        enrichedVideos.push({
          ...video,
          statistics,
          comments
        });
        
        await this.delay(100);
      }
      
      console.log('\n=== Сбор данных завершён! ===');
      return {
        channelId,
        uploadsPlaylistId,
        videos: enrichedVideos,
        totalVideos: enrichedVideos.length,
        collectedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('\n❌ Ошибка при сборе данных:', error.message);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Конвертация в CSV
  convertToCSV(data) {
    const rows = [];
    
    // Заголовки
    const headers = [
        'videoId',
        'title',
        'description',
        'publishedAt',
        'videoPublishedAt',
        'viewCount',
        'likeCount',
        'favoriteCount',
        'commentCount',
        'totalComments'
    ];
    
    rows.push(headers.join(','));
    
    // Функция для экранирования CSV полей
    const escapeCSV = (field) => {
        if (field === null || field === undefined) return '""';
        
        const str = String(field);
        
        // Если поле содержит запятые, кавычки или переносы строк - оборачиваем в кавычки
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        // Экранируем кавычки, удваивая их
        return `"${str.replace(/"/g, '""').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
        }
        
        return `"${str}"`;
    };
    
    // Данные для каждого видео
    data.videos.forEach(video => {
        const row = [
        escapeCSV(video.videoId),
        escapeCSV(video.title || ''),
        escapeCSV((video.description || '').substring(0, 200)), // Обрезаем до 200 символов
        escapeCSV(video.publishedAt),
        escapeCSV(video.videoPublishedAt),
        video.statistics?.viewCount || 0,
        video.statistics?.likeCount || 0,
        video.statistics?.favoriteCount || 0,
        video.statistics?.commentCount || 0,
        video.comments.length
        ];
        
        rows.push(row.join(','));
    });
    
    return rows.join('\r\n'); // Используем \r\n для совместимости с Excel
    }

  // Конвертация комментариев в отдельный CSV
  convertCommentsToCSV(data) {
    const rows = [];
    
    const headers = [
      'videoId',
      'videoTitle',
      'commentText',
      'likeCount',
      'updatedAt'
    ];
    
    rows.push(headers.join(','));
    
    data.videos.forEach(video => {
      video.comments.forEach(comment => {
        const row = [
          video.videoId,
          `"${(video.title || '').replace(/"/g, '""')}"`,
          `"${comment.textOriginal.replace(/"/g, '""')}"`,
          comment.likeCount,
          comment.updatedAt
        ];
        
        rows.push(row.join(','));
      });
    });
    
    return rows.join('\n');
  }

  async saveToFile(data, filename = 'youtube_data.json') {
    const fs = require('fs').promises;
    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 Данные сохранены в файл: ${filename}`);
  }

  async saveToCSV(data, filename = 'youtube_data.csv') {
    const fs = require('fs').promises;
    const csv = this.convertToCSV(data);
    await fs.writeFile(filename, csv, 'utf-8');
    console.log(`📊 CSV сохранён в файл: ${filename}`);
  }

  async saveCommentsToCSV(data, filename = 'youtube_comments.csv') {
    const fs = require('fs').promises;
    const csv = this.convertCommentsToCSV(data);
    await fs.writeFile(filename, csv, 'utf-8');
    console.log(`💬 CSV комментариев сохранён в файл: ${filename}`);
  }
}

// Использование
async function main() {
  const collector = new YouTubeDataCollector(YOUTUBE_API_KEY);
  
  const data = await collector.collectAllData(
    CHANNEL_QUERY,
    50,
    100
  );
  
  // Сохраняем в JSON
  await collector.saveToFile(data, 'youtube_mts_data.json');
  
  // Сохраняем в CSV (основные данные видео)
  await collector.saveToCSV(data, 'youtube_mts_videos.csv');
  
  // Сохраняем комментарии в отдельный CSV
  await collector.saveCommentsToCSV(data, 'youtube_mts_comments.csv');
  
  console.log('\n📊 Статистика:');
  console.log(`- Всего видео: ${data.totalVideos}`);
  console.log(`- Всего комментариев: ${data.videos.reduce((sum, v) => sum + v.comments.length, 0)}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = YouTubeDataCollector;
