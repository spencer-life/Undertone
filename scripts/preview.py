"""Loopback-only development preview: fresh files, no offline service worker."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        if self.path.split('?', 1)[0] in ('/', '/index.html'):
            body = (ROOT / 'index.html').read_bytes().replace(
                b'window.UNDERTONE_PREVIEW=false;', b'window.UNDERTONE_PREVIEW=true;')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return BytesIO(body)
        return super().send_head()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4178)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(PreviewHandler, directory=str(ROOT)))
    print(f'Undertone development preview: http://localhost:{args.port}/', flush=True)
    server.serve_forever()
