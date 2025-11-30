# Stats Collector Service - Инструкция по развёртыванию

## Описание

Сервис для сбора статистики с социальных сетей (YouTube). Работает как backend для интегральной схемы MWS Tables.

## Структура файлов

```
server/
├── stats_service.py            # Основной Python сервис
├── requirements.txt            # Python зависимости
├── stats.service               # Systemd unit файл
├── apache-stats.conf           # Конфигурация Apache
└── DEPLOY.md                   # Эта инструкция
```

## Развёртывание на Ubuntu

> [!NOTE] В этом гайде используется домен example.ru, при реальном использовании замените на собственный, не забудьте добавить DNS записи, и сертификаты (например letsencrypt - с помощью certbot)

### 1. Подготовка сервера

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Python и pip
sudo apt install -y python3 python3-pip python3-venv

# Установка Apache модулей для проксирования
sudo apt install -y libapache2-mod-proxy-html
sudo a2enmod proxy proxy_http headers
```

### 2. Создание директории и виртуального окружения

```bash
# Создаём директорию для сервиса
sudo mkdir -p /opt/stats-service
sudo chown $USER:$USER /opt/stats-service

# Копируем файлы сервиса (на забудьте указать ключ YT_API, его можно получить здесь: https://developers.google.com/youtube/v3/getting-started)
cp stats_service.py /opt/stats-service/
cp requirements.txt /opt/stats-service/

# Создаём виртуальное окружение
cd /opt/stats-service
python3 -m venv venv

# Активируем и устанавливаем зависимости
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Устанавливаем права для www-data
sudo chown -R www-data:www-data /opt/stats-service
```

### 3. Настройка Systemd сервиса

```bash
# Копируем unit файл
sudo cp stats.service /etc/systemd/system/

# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем автозапуск
sudo systemctl enable stats

# Запускаем сервис
sudo systemctl start stats

# Проверяем статус
sudo systemctl status stats
```

### 4. Настройка Apache

```bash
# Копируем конфигурацию
sudo cp apache-stats.conf /etc/apache2/sites-available/

# Включаем сайт
sudo a2ensite stats

# Проверяем конфигурацию
sudo apache2ctl configtest

# Перезапускаем Apache
sudo systemctl reload apache2
```

### 5. Проверка работы

```bash
# Проверка health endpoint
curl https://example.ru/stats/health

# Ожидаемый ответ:
# {"status":"healthy","service":"stats-collector","timestamp":"..."}

# Тестовый запрос на сбор статистики YouTube
curl -X POST https://example.ru/stats/collect \
  -H "Content-Type: application/json" \
  -d '{"source_type": "Youtube канал", "channel_alias": "MTSWebServices"}'

# Ожидаемый ответ (~ примерно через 1.5 минуты):
# {"status":"accepted","task_id":"uuid...","message":"Collection started"}
```

## Управление сервисом

```bash
# Статус
sudo systemctl status stats

# Перезапуск
sudo systemctl restart stats

# Остановка
sudo systemctl stop stats

# Логи
sudo journalctl -u stats -f

# Логи Apache
sudo tail -f /var/log/apache2/stats-error.log
sudo tail -f /var/log/apache2/stats-access.log
```