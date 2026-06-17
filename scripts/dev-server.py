#!/usr/bin/env python3
"""Local dev HTTP server with no-store caching. Usage: python3 scripts/dev-server.py [port]"""

import os
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class DevHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True


class DevServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    address_family = socket.AF_INET6


def main():
    os.chdir(ROOT)
    handler = partial(DevHandler, directory=ROOT)
    try:
        httpd = DevServer(("::", PORT), handler)
    except OSError:
        DevServer.address_family = socket.AF_INET
        httpd = DevServer(("0.0.0.0", PORT), handler)
    print(f"Loop Cam dev server (no-store) serving {ROOT}")
    print(f"  http://127.0.0.1:{PORT}/index.html")
    print(f"  http://localhost:{PORT}/index.html")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dev server.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
