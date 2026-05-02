# PentestKit Pro v1.0

A professional web-based penetration testing framework with a cyberpunk terminal UI.

## ⚠️ Legal Disclaimer

**FOR AUTHORIZED USE ONLY.** Only scan systems and networks you own or have explicit written permission to test. Unauthorized scanning is illegal in most jurisdictions.

---

## Features

| Module              | Description                                              |
|---------------------|----------------------------------------------------------|
| **Ping / Host Check** | ICMP ping with latency stats                          |
| **DNS Enumeration** | A, AAAA, MX, NS, TXT, CNAME, SOA + reverse DNS          |
| **WHOIS Lookup**    | Domain registration, registrar, nameservers              |
| **Subdomain Scan**  | Brute-force 60+ common subdomain names                   |
| **Port Scanner**    | Multi-threaded TCP scan with service detection & banners |
| **Network Sweep**   | Ping-sweep a /24 subnet for live hosts                   |
| **Traceroute**      | Network path with hop-by-hop routing                     |
| **HTTP Headers**    | Security header analysis with A–F grading               |
| **SSL/TLS Inspector** | Certificate details, cipher, protocol, expiry        |

---

## Requirements

- Python 3.8+
- Linux / macOS (uses `ping`, `traceroute`, `nslookup`, `whois` system commands)

---

## Quick Start

```bash
# 1. Make launcher executable
chmod +x start.sh

# 2. Start the server
./start.sh

# 3. Open browser
open http://localhost:5000
```

### Manual start

```bash
pip install -r requirements.txt
python3 app.py
```

---

## Project Structure

```
pentest-tool/
├── app.py              # Flask backend – all scanning logic
├── requirements.txt    # Python dependencies
├── start.sh            # One-click launcher
└── static/
    ├── index.html      # UI markup
    ├── style.css       # Cyberpunk terminal theme
    └── script.js       # Frontend logic & API calls
```

---

## API Endpoints

All endpoints accept POST with JSON body.

| Endpoint             | Body                               |
|----------------------|------------------------------------|
| `POST /api/ping`     | `{ "target": "example.com" }`     |
| `POST /api/dns`      | `{ "target": "example.com" }`     |
| `POST /api/whois`    | `{ "target": "example.com" }`     |
| `POST /api/subdomains` | `{ "target": "example.com" }`  |
| `POST /api/portscan` | `{ "target": "...", "scan_type": "common|range|custom", "port_range": "1-1024", "custom_ports": "80,443" }` |
| `POST /api/netscan`  | `{ "cidr": "192.168.1.0/24" }`   |
| `POST /api/traceroute` | `{ "target": "example.com" }` |
| `POST /api/headers`  | `{ "target": "https://example.com" }` |
| `POST /api/ssl`      | `{ "target": "example.com" }`    |
