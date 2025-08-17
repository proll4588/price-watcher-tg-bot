#!/bin/bash

# Скрипт для генерации WireGuard конфигурации GitHub Actions
# Использование: ./scripts/generate-wireguard-config.sh <home_server_public_key> <home_server_ip>

set -e

if [ $# -ne 2 ]; then
    echo "❌ Неверное количество аргументов"
    echo "Использование: $0 <home_server_public_key> <home_server_ip>"
    echo ""
    echo "Пример:"
    echo "  $0 'abc123...' '192.168.1.100'"
    exit 1
fi

HOME_SERVER_PUBLIC_KEY="$1"
HOME_SERVER_IP="$2"

echo "🔧 WireGuard Config Generator"
echo "============================="

echo "1️⃣ Генерируем ключи для GitHub Actions..."
mkdir -p /tmp/wireguard
wg genkey | tee /tmp/wireguard/github_actions_private.key | wg pubkey > /tmp/wireguard/github_actions_public.key

echo "2️⃣ Создаем конфигурацию GitHub Actions..."
cat > /tmp/wireguard/github-actions.conf << EOF
[Interface]
PrivateKey = $(cat /tmp/wireguard/github_actions_private.key)
Address = 10.0.0.2/32
DNS = 8.8.8.8

[Peer]
PublicKey = $HOME_SERVER_PUBLIC_KEY
Endpoint = $HOME_SERVER_IP:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
EOF

echo "3️⃣ Показываем конфигурацию для GitHub Secrets:"
echo "================================================"
echo "WIREGUARD_CONFIG:"
echo "=================="
cat /tmp/wireguard/github-actions.conf
echo "=================="

echo ""
echo "4️⃣ Показываем информацию для home server:"
echo "=========================================="
echo "GitHub Actions Public Key: $(cat /tmp/wireguard/github_actions_public.key)"
echo "GitHub Actions VPN IP: 10.0.0.2"
echo ""
echo "5️⃣ Добавьте в /etc/wireguard/wg0.conf на home server:"
echo "======================================================"
echo "[Peer]"
echo "PublicKey = $(cat /tmp/wireguard/github_actions_public.key)"
echo "AllowedIPs = 10.0.0.2/32"
echo "======================================================"

echo ""
echo "6️⃣ Команды для настройки на home server:"
echo "========================================"
echo "# Добавить peer в конфигурацию"
echo "cat >> /etc/wireguard/wg0.conf << 'EOF'"
echo "[Peer]"
echo "PublicKey = $(cat /tmp/wireguard/github_actions_public.key)"
echo "AllowedIPs = 10.0.0.2/32"
echo "EOF"
echo ""
echo "# Перезапустить WireGuard"
echo "wg-quick down wg0 && wg-quick up wg0"
echo "========================================"

echo ""
echo "✅ Конфигурация готова!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Скопируйте WIREGUARD_CONFIG в GitHub Secrets"
echo "2. Добавьте HOME_SERVER_VPN_IP = 10.0.0.1 в GitHub Secrets"
echo "3. Добавьте peer в конфигурацию home server"
echo "4. Перезапустите WireGuard на home server"
echo "5. Создайте тег для тестирования workflow"
