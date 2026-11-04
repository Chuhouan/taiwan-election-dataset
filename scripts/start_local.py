"""Start/reuse this local preview without a persistent terminal window."""
import argparse,os,socket,subprocess,sys,time,webbrowser
from pathlib import Path
from urllib.error import HTTPError,URLError
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
def status(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/',timeout=1) as response:
            return 'atlas' if '<title>臺灣選舉觀測</title>' in response.read(8192).decode('utf-8',errors='replace') else 'occupied'
    except HTTPError:return 'occupied'
    except (URLError,TimeoutError,OSError):
        with socket.socket() as probe:
            probe.settimeout(.2)
            return 'occupied' if probe.connect_ex(('127.0.0.1',port))==0 else 'offline'
def main():
    parser=argparse.ArgumentParser(description='Local Taiwan election preview')
    parser.add_argument('--port',type=int,default=4173);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
    if not 1024<=args.port<=65535:parser.error('port must be 1024–65535')
    state=status(args.port)
    if state=='occupied':raise SystemExit(f'Port {args.port} is already used by another service. No process was stopped.')
    if state=='offline':
        runtime=ROOT/'.local';runtime.mkdir(exist_ok=True)
        options={'cwd':str(ROOT),'stdin':subprocess.DEVNULL}
        if os.name=='nt':options['creationflags']=subprocess.CREATE_NO_WINDOW|subprocess.CREATE_NEW_PROCESS_GROUP
        else:options['start_new_session']=True
        with (runtime/'preview.log').open('ab') as log:
            child=subprocess.Popen([sys.executable,str(ROOT/'scripts/serve.py'),'--port',str(args.port)],stdout=log,stderr=log,**options)
        (runtime/'preview.pid').write_text(str(child.pid),encoding='ascii')
        for attempt in range(30):
            if status(args.port)=='atlas':break
            if child.poll() is not None:raise SystemExit('Preview could not start. See .local/preview.log.')
            time.sleep(.1)
        else:raise SystemExit('Preview did not become ready. See .local/preview.log.')
    url=f'http://127.0.0.1:{args.port}/';print('Local preview ready: '+url,flush=True)
    if not args.no_browser:webbrowser.open(url)
if __name__=='__main__':main()
