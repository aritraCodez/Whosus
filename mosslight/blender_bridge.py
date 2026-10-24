"""Small client for the running Blender MCP add-on's local execution socket."""
import argparse
import json
import socket
from pathlib import Path

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--script', type=Path)
source.add_argument('--code')
parser.add_argument('--timeout', type=float, default=180)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
code = args.script.read_text(encoding='utf-8') if args.script else args.code
request = {'type': 'execute', 'code': code, 'strict_json': True}
with socket.create_connection(('127.0.0.1', 9876), timeout=10) as connection:
    connection.settimeout(args.timeout)
    connection.sendall(json.dumps(request).encode('utf-8') + b'\0')
    data = bytearray()
    while b'\0' not in data:
        part = connection.recv(65536)
        if not part:
            raise RuntimeError('Blender closed the connection before sending a complete response')
        data.extend(part)
response = json.loads(data.split(b'\0', 1)[0])
report = json.dumps(response, indent=2)
if args.output:
    args.output.write_text(report, encoding='utf-8')
print(report)
if response.get('status') != 'ok':
    raise SystemExit(1)
