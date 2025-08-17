# 🔧 Настройка WireGuard VPN для CI/CD

## Обзор

WireGuard VPN позволяет GitHub Actions напрямую подключаться к home server, минуя jump server. Это упрощает архитектуру и повышает надежность.

## Архитектура

```
GitHub Actions → WireGuard VPN → Home Server
```

## Пошаговая настройка

### Шаг 1: Настройка WireGuard на Home Server

**Где выполнять:** На home server

```bash
# Запускаем скрипт настройки
sudo ./scripts/setup-wireguard.sh
```

**Что делает скрипт:**
- ✅ Устанавливает WireGuard
- ✅ Генерирует ключи
- ✅ Создает конфигурацию
- ✅ Включает IP forwarding
- ✅ Запускает сервис

### Шаг 2: Генерация конфигурации GitHub Actions

**Где выполнять:** На любом компьютере с WireGuard

```bash
# Получите public key home server
cat /etc/wireguard/public.key

# Сгенерируйте конфигурацию GitHub Actions
./scripts/generate-wireguard-config.sh "PUBLIC_KEY_HOME_SERVER" "IP_HOME_SERVER"
```

**Пример:**
```bash
./scripts/generate-wireguard-config.sh "abc123def456..." "192.168.1.100"
```

### Шаг 3: Настройка GitHub Secrets

**Где выполнять:** В веб-интерфейсе GitHub

Добавьте новые секреты:

| Название | Значение | Описание |
|----------|----------|----------|
| `WIREGUARD_CONFIG` | Конфигурация из скрипта | WireGuard конфигурация GitHub Actions |
| `HOME_SERVER_VPN_IP` | `10.0.0.1` | IP адрес home server в VPN |

### Шаг 4: Добавление peer на Home Server

**Где выполнять:** На home server

```bash
# Добавить peer в конфигурацию
cat >> /etc/wireguard/wg0.conf << 'EOF'
[Peer]
PublicKey = GITHUB_ACTIONS_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
EOF

# Перезапустить WireGuard
wg-quick down wg0 && wg-quick up wg0
```

### Шаг 5: Тестирование

**Где выполнять:** В GitHub Actions

```bash
# Создайте тег для запуска workflow
git tag v1.0.1
git push origin v1.0.1
```

## Проверка настроек

### На Home Server

```bash
# Проверка статуса WireGuard
sudo systemctl status wg-quick@wg0

# Проверка подключений
sudo wg show

# Проверка маршрутизации
ip route show

# Проверка firewall
sudo iptables -L FORWARD
```

### В GitHub Actions

Workflow автоматически:
- ✅ Устанавливает WireGuard
- ✅ Создает конфигурацию
- ✅ Запускает VPN
- ✅ Тестирует подключение
- ✅ Выполняет деплой

## Устранение неполадок

### Проблема: "Не удалось подключиться к home server через VPN"

**Решение:**
1. Проверьте, что WireGuard запущен на home server
2. Проверьте, что peer добавлен в конфигурацию
3. Проверьте firewall на home server
4. Проверьте, что порт 51820 открыт

### Проблема: "WireGuard не запускается"

**Решение:**
```bash
# Проверьте логи
sudo journalctl -u wg-quick@wg0 -f

# Проверьте конфигурацию
sudo wg-quick up wg0 --dry-run

# Проверьте права доступа
ls -la /etc/wireguard/
```

### Проблема: "Нет маршрутизации"

**Решение:**
```bash
# Включите IP forwarding
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p

# Проверьте iptables
sudo iptables -L FORWARD
```

## Безопасность

### ✅ Рекомендации

- Используйте уникальные ключи для каждого peer
- Ограничивайте AllowedIPs только необходимыми адресами
- Регулярно обновляйте ключи
- Мониторьте подключения
- Используйте firewall для дополнительной защиты

### ❌ Что НЕ делать

- Не используйте простые ключи
- Не открывайте WireGuard порт в публичном интернете без необходимости
- Не давайте доступ посторонним
- Не коммитьте приватные ключи в Git

## Команды для диагностики

### На Home Server

```bash
# Статус WireGuard
sudo wg show

# Логи WireGuard
sudo journalctl -u wg-quick@wg0 -f

# Проверка подключений
sudo ss -tulpn | grep 51820

# Проверка маршрутизации
ip route show table all
```

### В GitHub Actions

```bash
# Статус WireGuard
wg show

# Проверка маршрутизации
ip route show

# Тест подключения
ping -c 3 10.0.0.1
```

## Пример конфигурации

### Home Server (/etc/wireguard/wg0.conf)
```ini
[Interface]
PrivateKey = HOME_SERVER_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true

PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = GITHUB_ACTIONS_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
```

### GitHub Actions (WIREGUARD_CONFIG)
```ini
[Interface]
PrivateKey = GITHUB_ACTIONS_PRIVATE_KEY
Address = 10.0.0.2/32
DNS = 8.8.8.8

[Peer]
PublicKey = HOME_SERVER_PUBLIC_KEY
Endpoint = HOME_SERVER_IP:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
```

## Поддержка

При возникновении проблем:

1. Проверьте логи WireGuard: `sudo journalctl -u wg-quick@wg0 -f`
2. Проверьте статус сервиса: `sudo systemctl status wg-quick@wg0`
3. Проверьте конфигурацию: `sudo wg-quick up wg0 --dry-run`
4. Проверьте сетевую доступность: `ping` и `nc`
5. Создайте Issue в репозитории с результатами диагностики
