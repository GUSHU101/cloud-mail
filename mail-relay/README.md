# Cloud Mail 自建发信中继

该组件将 HTTPS 请求安全地提交给本机 Postfix，再由 Postfix 直接投递到收件方 MX。它不依赖 Resend、Mailgun、SendGrid 或 SendCloud。

## 必要条件

- 固定公网 IPv4，且服务商允许出站 TCP 25。
- 可为公网 IP 设置 PTR，PTR 必须指向 `MAIL_HOSTNAME`。
- `MAIL_HOSTNAME` 的 DNS A 记录必须反向指向同一个公网 IP，并设置为 Cloudflare DNS Only。
- 发信域名需要配置 SPF、DKIM 和 DMARC。
- 主机上已有 Nginx、Caddy 或其他 HTTPS 反向代理。

## 部署

如果你使用 LONGOS，无需执行本节：LONGOS 的 `./install.sh` 已把相同组件并入网站 Docker Compose，并通过 `/_longos/mail-relay` 提供 HTTPS 入口。本节只用于不安装 LONGOS 的独立 Cloud Mail 环境。

```bash
cd mail-relay
cp .env.example .env
openssl rand -hex 32
# 编辑 .env，填入域名和生成的 RELAY_SHARED_SECRET
docker compose up -d --build
docker compose logs -f relay
```

容器只把 API 暴露到主机的 `127.0.0.1:8788`。请在现有 Web 服务器中添加 HTTPS 反向代理，例如 Nginx：

```nginx
server {
    listen 443 ssl http2;
    server_name relay-api.example.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

`relay-api.example.com` 可以使用 Cloudflare 代理；`mailout.example.com` 必须为 DNS Only。不要把 8788 端口直接开放到公网。

## DNS

假设服务器 IP 为 `203.0.113.10`：

```text
mailout.example.com  A     203.0.113.10
example.com          TXT   "v=spf1 ip4:203.0.113.10 -all"
_dmarc.example.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@example.com"
```

PTR 由服务器供应商设置：

```text
203.0.113.10 -> mailout.example.com
```

首次启动会生成 2048 位 DKIM 密钥并在日志中打印 TXT 记录。也可以随时查看：

```bash
docker compose exec relay sh -c "find /var/lib/dkim -name '*.txt' -type f -exec cat {} \;"
```

## Cloudflare Worker

将 `.env` 中相同的密钥保存为 Worker secret：

```bash
cd ../mail-worker
printf '%s' '你的随机密钥' | npx wrangler secret put RELAY_SHARED_SECRET
```

然后运行一次 Cloud Mail 数据库初始化/升级，在系统设置中选择“自建邮件服务器”，填写：

```text
https://relay-api.example.com
```

## 安全边界

- API 使用 HMAC-SHA256、时间戳和一次性 nonce 验证请求。
- 仅允许 `ALLOWED_SENDER_DOMAINS` 中的发件域名。
- Postfix 仅监听容器回环地址，不能作为公网 Open Relay。
- API 有请求体、附件、收件人数和每分钟请求数限制。
- 密钥只保存在服务器 `.env` 和 Cloudflare Worker secret 中，不能提交到 Git。
