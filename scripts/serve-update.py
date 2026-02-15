import http.server
import socketserver
import socket
import os
import sys

PORT = 9999
FILE = "social-portal-portable.zip"

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS to find the route used for internet/LAN
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

# Ensure builds exists
if not os.path.exists(FILE):
    print(f"Error: {FILE} not found!")
    print("Please run 'npm run build:portable' first.")
    sys.exit(1)

IP = get_ip()

print("\n--- Termux Deployment Helper ---")
print("On your computer, this script is hosting the update file.")
print("On your Android phone (Termux), run this ONE command to download, unzip, and start:")
print(f"\nExample Command (use your Tailscale IP if on VPN):\n")
print(f"curl -L http://{IP}:{PORT}/{FILE} -o portal.zip && unzip -o portal.zip && go run scripts/server.go")
print(f"\nServing on 0.0.0.0:{PORT} (Press Ctrl+C to stop)...")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
