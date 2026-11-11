"""Local-only static preview with gzip and conditional requests. No account or cloud."""
import argparse,gzip,hashlib,mimetypes
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
ROOT=Path(__file__).resolve().parents[1]/'dist'
class PreviewServer(ThreadingHTTPServer):
 request_queue_size=128
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def do_GET(self):
  url=urlsplit(self.path)
  path=Path(self.translate_path(url.path))
  if path.is_dir() and not url.path.endswith('/'):
   target=url.path+'/'+('?' + url.query if url.query else '')
   self.send_response(301);self.send_header('Location',target);self.send_header('Content-Length','0');self.end_headers();return
  path=path/'index.html' if path.is_dir() else path
  if not path.is_file():self.send_error(404);return
  raw=path.read_bytes();etag='"'+hashlib.sha256(raw).hexdigest()[:20]+'"'
  if self.headers.get('If-None-Match')==etag:self.send_response(304);self.send_header('ETag',etag);self.end_headers();return
  compressed='gzip' in self.headers.get('Accept-Encoding','') and path.suffix in ['.json','.js','.css','.html','.svg']
  body=gzip.compress(raw,compresslevel=5) if compressed else raw
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(path)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(body)));self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding')
  self.send_header('Cache-Control','public,max-age=31536000,immutable' if 'v' in parse_qs(urlsplit(self.path).query) and path.suffix in ['.js','.css'] else 'no-cache')
  if compressed:self.send_header('Content-Encoding','gzip')
  self.end_headers();self.wfile.write(body)
 def log_message(self,*a):pass
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4173);a=p.parse_args();print(f'Local preview: http://127.0.0.1:{a.port}',flush=True);PreviewServer(('127.0.0.1',a.port),Handler).serve_forever()
