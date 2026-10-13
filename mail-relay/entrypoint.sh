#!/bin/sh
set -eu

: "${MAIL_HOSTNAME:?MAIL_HOSTNAME is required}"
: "${MAIL_DOMAINS:?MAIL_DOMAINS is required}"

if [ -z "${RELAY_SHARED_SECRET:-}" ] \
  && [ -z "${LONGOS_RELAY_SHARED_SECRET:-}" ] \
  && [ -z "${CLOUD_MAIL_RELAY_SHARED_SECRET:-}" ]; then
  echo "At least one relay client secret is required" >&2
  exit 1
fi

DKIM_SELECTOR="${DKIM_SELECTOR:-mail2026}"
INET_PROTOCOLS="${INET_PROTOCOLS:-ipv4}"

printf '%s\n' "$MAIL_HOSTNAME" > /etc/mailname
mkdir -p /run/opendkim /etc/opendkim /var/lib/dkim
chown opendkim:opendkim /run/opendkim /var/lib/dkim

: > /etc/opendkim/KeyTable
: > /etc/opendkim/SigningTable
printf '127.0.0.1\nlocalhost\n' > /etc/opendkim/TrustedHosts

old_ifs="$IFS"
IFS=','
for raw_domain in $MAIL_DOMAINS; do
  domain="$(printf '%s' "$raw_domain" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  [ -n "$domain" ] || continue
  key_dir="/var/lib/dkim/$domain"
  mkdir -p "$key_dir"
  if [ ! -s "$key_dir/$DKIM_SELECTOR.private" ]; then
    opendkim-genkey -b 2048 -d "$domain" -D "$key_dir" -s "$DKIM_SELECTOR"
  fi
  chown -R opendkim:opendkim "$key_dir"
  chmod 0700 "$key_dir"
  chmod 0600 "$key_dir/$DKIM_SELECTOR.private"
  printf '%s._domainkey.%s %s:%s:%s/%s.private\n' \
    "$DKIM_SELECTOR" "$domain" "$domain" "$DKIM_SELECTOR" "$key_dir" "$DKIM_SELECTOR" \
    >> /etc/opendkim/KeyTable
  printf '*@%s %s._domainkey.%s\n' "$domain" "$DKIM_SELECTOR" "$domain" \
    >> /etc/opendkim/SigningTable
  printf '%s\n*.%s\n' "$domain" "$domain" >> /etc/opendkim/TrustedHosts
done
IFS="$old_ifs"

cat > /etc/opendkim.conf <<EOF
Syslog                  yes
UMask                   007
Mode                    sv
Canonicalization        relaxed/simple
OversignHeaders         From
UserID                  opendkim
PidFile                 /run/opendkim/opendkim.pid
Socket                  inet:8891@127.0.0.1
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
EOF

postconf -e "myhostname = $MAIL_HOSTNAME"
postconf -e "myorigin = \$mydomain"
postconf -e "mydestination = localhost"
postconf -e "inet_interfaces = loopback-only"
postconf -e "inet_protocols = $INET_PROTOCOLS"
postconf -e "mynetworks = 127.0.0.0/8 [::1]/128"
postconf -e "relayhost ="
postconf -e "smtp_helo_name = \$myhostname"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"
postconf -e "smtp_tls_loglevel = 1"
postconf -e "disable_dns_lookups = no"
postconf -e "maillog_file = /dev/stdout"
postconf -e "milter_default_action = tempfail"
postconf -e "milter_protocol = 6"
postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

opendkim -x /etc/opendkim.conf
postfix check
postfix start

echo "Cloud Mail relay started. Publish each DKIM TXT record shown below:"
find /var/lib/dkim -maxdepth 3 -type f -name '*.txt' -print -exec cat {} \;

node /app/src/server.mjs &
node_pid=$!

shutdown() {
  kill "$node_pid" 2>/dev/null || true
  postfix stop 2>/dev/null || true
  pkill opendkim 2>/dev/null || true
  wait "$node_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT
wait "$node_pid"
