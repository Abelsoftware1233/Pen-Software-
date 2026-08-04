#!/usr/bin/env python3
"""
PentestKit Pro - Penetration Testing Framework
A professional web-based penetration testing tool
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import subprocess
import socket
import threading
import json
import os
import re
import ssl
import time
import ipaddress
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.parse
import http.client

app = Flask(__name__, static_folder='static')
CORS(app)

# ─── Utility ────────────────────────────────────────────────────────────────

def timestamp():
    return datetime.now().strftime("%H:%M:%S")

def validate_target(target):
    """Basic validation – only allow hostnames/IPs, no shell metacharacters."""
    if not target:
        return False, "No target specified"
    if len(target) > 253:
        return False, "Target too long"
    # Allow IPs and hostnames with optional port
    clean = target.split(":")[0]
    pattern = r'^[a-zA-Z0-9\.\-\_]+$'
    if not re.match(pattern, clean):
        return False, "Invalid target format"
    return True, "OK"

# ─── Port Scanner ────────────────────────────────────────────────────────────

COMMON_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC",
    6379: "Redis", 8080: "HTTP-Alt", 8443: "HTTPS-Alt", 8888: "HTTP-Alt2",
    27017: "MongoDB", 9200: "Elasticsearch", 11211: "Memcached"
}

def scan_port(host, port, timeout=1.5):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            service = COMMON_PORTS.get(port, "Unknown")
            banner = grab_banner(host, port)
            return {"port": port, "state": "open", "service": service, "banner": banner}
    except Exception:
        pass
    return None

def grab_banner(host, port, timeout=2):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.send(b"HEAD / HTTP/1.0\r\n\r\n")
        banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()
        sock.close()
        return banner[:200] if banner else ""
    except Exception:
        return ""

@app.route("/api/portscan", methods=["POST"])
def port_scan():
    data = request.json
    target = data.get("target", "").strip()
    scan_type = data.get("scan_type", "common")  # common | range | custom
    port_range = data.get("port_range", "1-1024")
    custom_ports = data.get("custom_ports", "")

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        host = socket.gethostbyname(target)
    except socket.gaierror as e:
        return jsonify({"error": f"Cannot resolve host: {e}"}), 400

    ports_to_scan = []
    if scan_type == "common":
        ports_to_scan = list(COMMON_PORTS.keys())
    elif scan_type == "range":
        try:
            start, end = map(int, port_range.split("-"))
            ports_to_scan = list(range(max(1, start), min(65535, end) + 1))
        except Exception:
            return jsonify({"error": "Invalid port range"}), 400
    elif scan_type == "custom":
        try:
            ports_to_scan = [int(p.strip()) for p in custom_ports.split(",") if p.strip()]
        except Exception:
            return jsonify({"error": "Invalid custom ports"}), 400

    start_time = time.time()
    open_ports = []

    with ThreadPoolExecutor(max_workers=100) as executor:
        futures = {executor.submit(scan_port, host, p): p for p in ports_to_scan}
        for future in as_completed(futures):
            result = future.result()
            if result:
                open_ports.append(result)

    open_ports.sort(key=lambda x: x["port"])
    elapsed = round(time.time() - start_time, 2)

    return jsonify({
        "target": target,
        "ip": host,
        "ports_scanned": len(ports_to_scan),
        "open_ports": open_ports,
        "elapsed": elapsed,
        "timestamp": timestamp()
    })

# ─── DNS Enumeration ─────────────────────────────────────────────────────────

@app.route("/api/dns", methods=["POST"])
def dns_enum():
    data = request.json
    target = data.get("target", "").strip()

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    results = {}

    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]
    for rtype in record_types:
        try:
            proc = subprocess.run(
                ["nslookup", f"-type={rtype}", target],
                capture_output=True, text=True, timeout=5
            )
            output = proc.stdout
            if output and "NXDOMAIN" not in output and "can't find" not in output.lower():
                results[rtype] = [line.strip() for line in output.splitlines()
                                  if line.strip() and not line.startswith("Server") and not line.startswith("Address")]
        except Exception as e:
            results[rtype] = [f"Error: {e}"]

    # Try reverse DNS
    try:
        ip = socket.gethostbyname(target)
        reverse = socket.gethostbyaddr(ip)
        results["REVERSE"] = [f"{ip} -> {reverse[0]}"]
    except Exception:
        results["REVERSE"] = ["Not available"]

    return jsonify({
        "target": target,
        "records": results,
        "timestamp": timestamp()
    })

# ─── HTTP Header Analysis ─────────────────────────────────────────────────────

SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-XSS-Protection",
    "Access-Control-Allow-Origin",
]

@app.route("/api/headers", methods=["POST"])
def analyze_headers():
    data = request.json
    target = data.get("target", "").strip()

    if not target.startswith(("http://", "https://")):
        target = "https://" + target

    try:
        parsed = urllib.parse.urlparse(target)
        host = parsed.netloc or parsed.path
        path = parsed.path if parsed.netloc else "/"
        use_ssl = target.startswith("https://")
        port = 443 if use_ssl else 80

        if use_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            conn = http.client.HTTPSConnection(host, port, timeout=10, context=ctx)
        else:
            conn = http.client.HTTPConnection(host, port, timeout=10)

        conn.request("GET", path or "/", headers={"User-Agent": "PentestKit/1.0"})
        resp = conn.getresponse()

        headers_dict = dict(resp.getheaders())
        conn.close()

        security_analysis = []
        for sh in SECURITY_HEADERS:
            present = any(k.lower() == sh.lower() for k in headers_dict)
            security_analysis.append({
                "header": sh,
                "present": present,
                "value": next((v for k, v in headers_dict.items() if k.lower() == sh.lower()), None),
                "risk": "LOW" if present else "HIGH"
            })

        score = sum(1 for s in security_analysis if s["present"])
        grade = "A" if score >= 7 else "B" if score >= 5 else "C" if score >= 3 else "D" if score >= 1 else "F"

        return jsonify({
            "target": target,
            "status_code": resp.status,
            "all_headers": headers_dict,
            "security_analysis": security_analysis,
            "score": score,
            "max_score": len(SECURITY_HEADERS),
            "grade": grade,
            "timestamp": timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── SSL/TLS Inspector ────────────────────────────────────────────────────────

@app.route("/api/ssl", methods=["POST"])
def ssl_inspect():
    data = request.json
    target = data.get("target", "").strip().replace("https://", "").replace("http://", "").split("/")[0]

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        with socket.create_connection((target, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=target) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
                version = ssock.version()

        # Parse cert dates
        not_before = cert.get("notBefore", "")
        not_after = cert.get("notAfter", "")

        subject = dict(x[0] for x in cert.get("subject", []))
        issuer = dict(x[0] for x in cert.get("issuer", []))
        san = [v for _, v in cert.get("subjectAltName", [])]

        # Check expiry
        try:
            expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
            days_left = (expiry - datetime.utcnow()).days
            expired = days_left < 0
        except Exception:
            days_left = None
            expired = False

        issues = []
        if expired:
            issues.append({"severity": "CRITICAL", "msg": "Certificate is EXPIRED"})
        elif days_left and days_left < 30:
            issues.append({"severity": "HIGH", "msg": f"Certificate expires in {days_left} days"})

        weak_ciphers = ["RC4", "DES", "3DES", "NULL", "EXPORT", "MD5"]
        if cipher and any(w in cipher[0] for w in weak_ciphers):
            issues.append({"severity": "HIGH", "msg": f"Weak cipher: {cipher[0]}"})

        if version in ["SSLv2", "SSLv3", "TLSv1", "TLSv1.1"]:
            issues.append({"severity": "HIGH", "msg": f"Outdated protocol: {version}"})

        return jsonify({
            "target": target,
            "subject": subject,
            "issuer": issuer,
            "san": san,
            "not_before": not_before,
            "not_after": not_after,
            "days_left": days_left,
            "expired": expired,
            "cipher": cipher,
            "version": version,
            "issues": issues,
            "timestamp": timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Subdomain Enumerator ─────────────────────────────────────────────────────

SUBDOMAINS = [
    "www", "mail", "ftp", "ssh", "vpn", "admin", "portal", "dev", "staging",
    "test", "api", "cdn", "shop", "store", "blog", "app", "mobile", "m",
    "smtp", "pop", "imap", "webmail", "remote", "secure", "login", "auth",
    "beta", "demo", "support", "help", "status", "monitor", "dashboard",
    "intranet", "internal", "corp", "git", "svn", "jenkins", "jira", "wiki",
    "docs", "download", "uploads", "static", "assets", "media", "images",
    "db", "database", "mysql", "pg", "redis", "es", "elastic", "kafka"
]

def check_subdomain(sub, domain):
    full = f"{sub}.{domain}"
    try:
        ip = socket.gethostbyname(full)
        return {"subdomain": full, "ip": ip, "status": "found"}
    except Exception:
        return None

@app.route("/api/subdomains", methods=["POST"])
def subdomain_enum():
    data = request.json
    target = data.get("target", "").strip()
    # Strip protocol
    target = target.replace("https://", "").replace("http://", "").split("/")[0]

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    found = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(check_subdomain, sub, target): sub for sub in SUBDOMAINS}
        for future in as_completed(futures):
            result = future.result()
            if result:
                found.append(result)

    found.sort(key=lambda x: x["subdomain"])

    return jsonify({
        "target": target,
        "checked": len(SUBDOMAINS),
        "found": found,
        "timestamp": timestamp()
    })

# ─── Ping / Host Discovery ────────────────────────────────────────────────────

@app.route("/api/ping", methods=["POST"])
def ping_host():
    data = request.json
    target = data.get("target", "").strip()

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        # Resolve IP
        ip = socket.gethostbyname(target)

        # Ping
        proc = subprocess.run(
            ["ping", "-c", "4", "-W", "2", ip],
            capture_output=True, text=True, timeout=15
        )
        output = proc.stdout

        # Parse stats
        alive = proc.returncode == 0
        stats = {}
        for line in output.splitlines():
            if "packets transmitted" in line:
                stats["summary"] = line.strip()
            if "rtt min" in line or "round-trip" in line:
                stats["rtt"] = line.strip()

        return jsonify({
            "target": target,
            "ip": ip,
            "alive": alive,
            "output": output,
            "stats": stats,
            "timestamp": timestamp()
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Ping timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Traceroute ───────────────────────────────────────────────────────────────

@app.route("/api/traceroute", methods=["POST"])
def traceroute():
    data = request.json
    target = data.get("target", "").strip()

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        ip = socket.gethostbyname(target)
        proc = subprocess.run(
            ["traceroute", "-m", "20", "-w", "2", ip],
            capture_output=True, text=True, timeout=60
        )
        hops = []
        for line in proc.stdout.splitlines()[1:]:
            hops.append(line.strip())

        return jsonify({
            "target": target,
            "ip": ip,
            "hops": hops,
            "raw": proc.stdout,
            "timestamp": timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── WHOIS ───────────────────────────────────────────────────────────────────

@app.route("/api/whois", methods=["POST"])
def whois_lookup():
    data = request.json
    target = data.get("target", "").strip().replace("https://", "").replace("http://", "").split("/")[0]

    valid, msg = validate_target(target)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        proc = subprocess.run(
            ["whois", target],
            capture_output=True, text=True, timeout=15
        )
        output = proc.stdout

        # Extract key fields
        fields = {}
        patterns = {
            "Registrar": r"Registrar:\s*(.+)",
            "Creation Date": r"Creation Date:\s*(.+)",
            "Updated Date": r"Updated Date:\s*(.+)",
            "Expiry Date": r"Registry Expiry Date:\s*(.+)|Expiry Date:\s*(.+)",
            "Name Servers": r"Name Server:\s*(.+)",
            "Status": r"Domain Status:\s*(.+)",
            "Registrant": r"Registrant Organization:\s*(.+)|Registrant:\s*(.+)",
        }
        for field, pattern in patterns.items():
            matches = re.findall(pattern, output, re.IGNORECASE)
            if matches:
                vals = []
                for m in matches:
                    val = m if isinstance(m, str) else next((x for x in m if x), "")
                    if val:
                        vals.append(val.strip())
                fields[field] = list(dict.fromkeys(vals))  # deduplicate

        return jsonify({
            "target": target,
            "fields": fields,
            "raw": output[:3000],
            "timestamp": timestamp()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Network Range Scanner ────────────────────────────────────────────────────

@app.route("/api/netscan", methods=["POST"])
def network_scan():
    data = request.json
    cidr = data.get("cidr", "").strip()

    try:
        network = ipaddress.IPv4Network(cidr, strict=False)
    except ValueError as e:
        return jsonify({"error": f"Invalid CIDR: {e}"}), 400

    if network.num_addresses > 256:
        return jsonify({"error": "Max /24 (256 hosts) for performance"}), 400

    def ping_ip(ip):
        proc = subprocess.run(
            ["ping", "-c", "1", "-W", "1", str(ip)],
            capture_output=True
        )
        return {"ip": str(ip), "alive": proc.returncode == 0}

    hosts = list(network.hosts())
    results = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(ping_ip, ip) for ip in hosts]
        for future in as_completed(futures):
            result = future.result()
            if result["alive"]:
                results.append(result)

    results.sort(key=lambda x: ipaddress.IPv4Address(x["ip"]))

    return jsonify({
        "cidr": cidr,
        "total_hosts": len(hosts),
        "alive": results,
        "count": len(results),
        "timestamp": timestamp()
    })

# ─── Serve Frontend ───────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("╔══════════════════════════════════════╗")
    print("║       PentestKit Pro v1.0            ║")
    print("║  http://87.106.41.140:8080
               ║")
    print("╚══════════════════════════════════════╝")
    app.run(debug=False, host="0.0.0.0", port=8080)
