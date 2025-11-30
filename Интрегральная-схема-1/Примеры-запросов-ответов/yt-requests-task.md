1. получить "channelId"

curl "https://www.googleapis.com/youtube/v3/search?type=channel^&q=@MTSWebServices^&key=12345678910"


2. получить contentDetails.relatedPlaylists.uploads

curl "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCxwkaD_tK-bQ_hB3ZFBeSww&key=12345678910"

3. получить список видео 

curl "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=UUxwkaD_tK-bQ_hB3ZFBeSww&maxResults=50&key=xxxxxxxx"

Собрать следующие поля:
items[*].snippet.publishedAt
items[*].snippet.title
items[*].snippet.description
items[*].contentDetails.videoId
items[*].contentDetails.videoPublishedAt

4. для КАЖДОГО items[*].contentDetails.videoId из 3 пункта сделать запрос
curl "https://www.googleapis.com/youtube/v3/videos?part=statistics&id=D6TCMyCiyjo&key=xxxxxxxx"

Собрать следующие поля:
items[0].statistics.viewCount
items[0].statistics.likeCount
items[0].statistics.favoriteCount
items[0].statistics.commentCount

5. собрать комментарии под видео
curl "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=D6TCMyCiyjo&maxResults=100&order=relevance&key=xxxxxxxx"
для каждого комментария собрать 
items[0].snippet.topLevelComment.snippet.textOriginal
items[0].snippet.topLevelComment.snippet.likeCount
items[0].snippet.topLevelComment.snippet.updatedAt