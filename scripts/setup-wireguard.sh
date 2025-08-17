#!/bin/bash

# Скрипт для настройки WireGuard на home server
# Использование: ./scripts/setup-wireguard.sh

set -e

echo "🔧 WireGuard Setup Tool"
echo "======================="

# Проверяем, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Скрипт должен быть запущен от root (sudo)"
    exit 1
fi

echo "1️⃣ Устанавливаем WireGuard..."
apt-get update
apt-get install -y wireguard wireguard-tools

echo "2️⃣ Генерируем ключи для home server..."
if [ ! -f /etc/wireguard/private.key ]; then
    wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
    chmod 600 /etc/wireguard/private.key
    chmod 644 /etc/wireguard/public.key
    echo "✅ Ключи созданы"
else
    echo "✅ Ключи уже существуют"
fi

echo "3️⃣ Создаем конфигурацию WireGuard..."
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = $(cat /etc/wireguard/private.key)
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true

# Включаем IP forwarding
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF

chmod 600 /etc/wireguard/wg0.conf

echo "4️⃣ Включаем IP forwarding..."
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p

echo "5️⃣ Запускаем WireGuard..."
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

echo "6️⃣ Проверяем статус..."
systemctl status wg-quick@wg0 --no-pager -l

echo ""
echo "✅ WireGuard настроен и запущен!"
echo ""
echo "📋 Информация для GitHub Actions:"
echo "=================================="
echo "Public Key: $(cat /etc/wireguard/public.key)"
echo "VPN IP: 10.0.0.1"
echo "Port: 51820"
echo ""
echo "🔧 Для добавления GitHub Actions peer:"
echo "1. Создайте ключи на GitHub Actions:"
echo "   wg genkey | tee github_actions_private.key | wg pubkey > github_actions_public.key"
echo ""
echo "2. Добавьте peer в /etc/wireguard/wg0.conf:"
echo "   [Peer]"
echo "   PublicKey = <github_actions_public_key>"
echo "   AllowedIPs = 10.0.0.2/32"
echo ""
echo "3. Перезапустите WireGuard:"
echo "   wg-quick down wg0 && wg-quick up wg0"
echo ""
echo "4. Добавьте в GitHub Secrets:"
echo "   WIREGUARD_CONFIG = <конфигурация GitHub Actions>"
echo "   HOME_SERVER_VPN_IP = 10.0.0.1"
