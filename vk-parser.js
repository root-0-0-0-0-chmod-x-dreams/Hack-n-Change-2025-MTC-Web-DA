// vk-parser.js
const VK_ACCESS_TOKEN = 'vk1.a.WvCzReq0TlpUDgOvppA_pj5e1B8uo53p1WxnDAjC-ngguprxYb0SyKuA_llE9Yrwjvz7_tNWjASXwz3cP9Uv_V9L58jR5r5LzkTElrjgKpJjQwfr_wLssB4fX7Yn4In3K2GfYSDQm5p-hN70jUNwhM74RpPjPDZUmpGBNgUYNnhDPmIjvMme-Gb8SjCrg9Zvc5GfZiMdrtepS8Oip9eEJQ';
const GROUP_QUERY = 'mtswebservices';
const API_VERSION = '5.199';

class VKParser {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://api.vk.com/method';
    this.apiVersion = API_VERSION;
  }

  async fetchJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`VK API error: ${data.error.error_msg} (code: ${data.error.error_code})`);
      }
      
      return data;
    } catch (error) {
      console.error('Ошибка запроса:', error);
      throw error;
    }
  }

  // Шаг 1: Поиск группы
  async searchGroup(query) {
    const url = `${this.baseURL}/groups.search?q=${encodeURIComponent(query)}&type=group&count=20&access_token=${this.accessToken}&v=${this.apiVersion}`;
    console.log('🔍 Шаг 1: Ищем группу...');
    
    const data = await this.fetchJSON(url);
    
    if (!data.response || !data.response.items || data.response.items.length === 0) {
      throw new Error('Группа не найдена');
    }
    
    const groupId = data.response.items[0].id;
    const groupName = data.response.items[0].name;
    console.log(`✓ Найдена группа: "${groupName}" (ID: ${groupId})`);
    return groupId;
  }

  // Шаг 2: Получение постов со стены
  async getWallPosts(groupId, maxPosts = 100) {
    const url = `${this.baseURL}/wall.get?owner_id=-${groupId}&count=${maxPosts}&access_token=${this.accessToken}&v=${this.apiVersion}`;
    console.log(`\n📄 Шаг 2: Получаем посты (максимум ${maxPosts})...`);
    
    const data = await this.fetchJSON(url);
    
    if (!data.response || !data.response.items) {
      return [];
    }

    const allPosts = data.response.items;
    console.log(`   Получено постов: ${allPosts.length}`);

    // Фильтрация постов
    const filteredPosts = allPosts.filter(post => {
      // Отфильтровываем рекламу
      if (post.marked_as_ads && post.marked_as_ads > 0) return false;
      
      // Только посты
      if (post.post_type !== 'post') return false;
      
      // Должен быть текст
      if (!post.text || post.text.trim().length === 0) return false;
      
      return true;
    });

    console.log(`   После фильтрации: ${filteredPosts.length} постов`);

    const posts = filteredPosts.map(post => ({
      publishedAt: post.date,
      publishedDate: this.formatTimestamp(post.date),
      postId: post.id,
      title: this.extractTitle(post.text),
      description: post.text,
      viewCount: post.views?.count || 0,
      likeCount: post.likes?.count || 0,
      commentCount: post.comments?.count || 0,
      repostCount: post.reposts?.count || 0
    }));

    return posts;
  }

  // Шаг 3: Получение комментариев
  async getComments(groupId, postId, maxComments = 100) {
    const url = `${this.baseURL}/wall.getComments?owner_id=-${groupId}&post_id=${postId}&count=${maxComments}&access_token=${this.accessToken}&v=${this.apiVersion}`;
    
    try {
      const data = await this.fetchJSON(url);
      
      if (!data.response || !data.response.items) {
        return [];
      }

      const comments = data.response.items
        .filter(comment => comment.text && comment.text.trim().length > 0)
        .map(comment => ({
          commentId: comment.id,
          text: comment.text,
          likeCount: comment.likes?.count || 0,
          date: comment.date,
          formattedDate: this.formatTimestamp(comment.date)
        }));

      return comments;
    } catch (error) {
      console.log(`  ⚠ Не удалось получить комментарии для поста ${postId}`);
      return [];
    }
  }

  // Основной метод сбора данных
  async collectData(groupQuery, maxPosts = 100, maxCommentsPerPost = 100) {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   Парсер ВКонтакте - Начало работы   ║');
    console.log('╚═══════════════════════════════════════╝\n');
    
    try {
      // Шаг 1: Ищем группу
      const groupId = await this.searchGroup(groupQuery);
      
      // Шаг 2: Получаем посты
      const posts = await this.getWallPosts(groupId, maxPosts);
      
      if (posts.length === 0) {
        console.log('\n⚠ Не найдено подходящих постов');
        return null;
      }

      // Шаг 3: Собираем комментарии для каждого поста
      console.log(`\n💬 Шаг 3: Собираем комментарии...`);
      
      const postsWithComments = [];
      
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const progress = `[${i + 1}/${posts.length}]`;
        
        process.stdout.write(`   ${progress} Пост ${post.postId}...`);
        
        const comments = await this.getComments(groupId, post.postId, maxCommentsPerPost);
        
        console.log(` ${comments.length} комментариев`);
        
        postsWithComments.push({
          ...post,
          comments: comments
        });
        
        // Задержка для соблюдения rate limits
        await this.delay(350);
      }
      
      const totalComments = postsWithComments.reduce((sum, p) => sum + p.comments.length, 0);
      
      console.log('\n╔═══════════════════════════════════════╗');
      console.log('║         Сбор данных завершён!        ║');
      console.log('╚═══════════════════════════════════════╝');
      console.log(`\n📊 Статистика:`);
      console.log(`   • Постов собрано: ${postsWithComments.length}`);
      console.log(`   • Комментариев собрано: ${totalComments}`);
      
      return {
        groupId: groupId,
        groupQuery: groupQuery,
        posts: postsWithComments,
        totalPosts: postsWithComments.length,
        totalComments: totalComments,
        collectedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('\n❌ Ошибка:', error.message);
      throw error;
    }
  }

  // Вспомогательные функции
  extractTitle(text) {
    if (!text) return '';
    const firstLine = text.split('\n')[0];
    return firstLine.length > 150 
      ? firstLine.substring(0, 150) + '...' 
      : firstLine;
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toISOString();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeCSV(field) {
    if (field === null || field === undefined) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
    }
    return `"${str}"`;
  }

  // Экспорт в CSV - Посты
  exportPostsToCSV(data) {
    const rows = [];
    
    const headers = [
      'publishedAt',
      'publishedDate',
      'postId',
      'title',
      'description',
      'viewCount',
      'likeCount',
      'repostCount',
      'commentCount',
      'actualComments'
    ];
    
    rows.push(headers.join(','));
    
    data.posts.forEach(post => {
      const row = [
        post.publishedAt,
        this.escapeCSV(post.publishedDate),
        post.postId,
        this.escapeCSV(post.title),
        this.escapeCSV(post.description.substring(0, 200)),
        post.viewCount,
        post.likeCount,
        post.repostCount,
        post.commentCount,
        post.comments.length
      ];
      rows.push(row.join(','));
    });
    
    return rows.join('\r\n');
  }

  // Экспорт в CSV - Комментарии
  exportCommentsToCSV(data) {
    const rows = [];
    
    const headers = [
      'commentDate',
      'formattedDate',
      'postId',
      'postTitle',
      'commentText',
      'likeCount'
    ];
    
    rows.push(headers.join(','));
    
    data.posts.forEach(post => {
      post.comments.forEach(comment => {
        const row = [
          comment.date,
          this.escapeCSV(comment.formattedDate),
          post.postId,
          this.escapeCSV(post.title),
          this.escapeCSV(comment.text),
          comment.likeCount
        ];
        rows.push(row.join(','));
      });
    });
    
    return rows.join('\r\n');
  }

  // Сохранение файлов
  async saveJSON(data, filename = 'vk_data.json') {
    const fs = require('fs').promises;
    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 JSON: ${filename}`);
  }

  async savePostsCSV(data, filename = 'vk_posts.csv') {
    const fs = require('fs').promises;
    const csv = this.exportPostsToCSV(data);
    await fs.writeFile(filename, csv, 'utf-8');
    console.log(`📊 CSV постов: ${filename}`);
  }

  async saveCommentsCSV(data, filename = 'vk_comments.csv') {
    const fs = require('fs').promises;
    const csv = this.exportCommentsToCSV(data);
    await fs.writeFile(filename, csv, 'utf-8');
    console.log(`💬 CSV комментариев: ${filename}`);
  }

  async saveAll(data, prefix = 'vk_mts') {
    await this.saveJSON(data, `${prefix}_data.json`);
    await this.savePostsCSV(data, `${prefix}_posts.csv`);
    await this.saveCommentsCSV(data, `${prefix}_comments.csv`);
  }
}

// Главная функция
async function main() {
  const parser = new VKParser(VK_ACCESS_TOKEN);
  
  const data = await parser.collectData(
    GROUP_QUERY,
    100,  // максимум постов
    100   // максимум комментариев на пост
  );
  
  if (data) {
    await parser.saveAll(data, 'vk_mts');
    console.log('\n✅ Все файлы сохранены!');
  }
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = VKParser;
