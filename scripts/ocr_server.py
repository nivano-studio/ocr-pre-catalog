"""
Servidor HTTP Local de OCR (RapidOCR PP-OCRv4)
Exclusivo para Windows localhost (127.0.0.1:5001).
Sem tráfego externo, sem nuvem, sem persistência de imagens em disco.
"""

import sys
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import numpy as np
import cv2

from ocr_engine import process_image

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

HOST = '127.0.0.1'
PORT = 5001

class LocalOCRHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Manual-Angle')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            resp = {
                'status': 'ok',
                'engine': 'rapidocr-ppocrv4-onnx',
                'host': HOST,
                'port': PORT
            }
            self.wfile.write(json.dumps(resp).encode('utf-8'))
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/ocr':
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(b'{"error": "Endpoint not found"}')
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error": "Empty body"}')
                return

            body = self.rfile.read(content_length)

            # Manual angle opcional via header ou query param
            query_params = parse_qs(parsed.query)
            manual_angle = None
            if 'manual_angle' in query_params:
                try:
                    manual_angle = int(query_params['manual_angle'][0])
                except ValueError:
                    pass
            elif 'X-Manual-Angle' in self.headers:
                try:
                    manual_angle = int(self.headers['X-Manual-Angle'])
                except ValueError:
                    pass

            # Decodifica imagem diretamente da memória
            nparr = np.frombuffer(body, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                # Tenta lidar com multipart se enviado como formulário
                # Procura bytes JPEG/PNG/WEBP na carga
                jpeg_start = body.find(b'\xff\xd8\xff')
                png_start = body.find(b'\x89PNG\r\n\x1a\n')
                webp_start = body.find(b'RIFF')
                start_idx = -1
                if jpeg_start != -1:
                    start_idx = jpeg_start
                elif png_start != -1:
                    start_idx = png_start
                elif webp_start != -1:
                    start_idx = webp_start

                if start_idx != -1:
                    nparr = np.frombuffer(body[start_idx:], np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                self.send_response(400)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(b'{"error": "Invalid image payload"}')
                return

            # Executa OCR local em memória
            result = process_image(img, manual_angle=manual_angle)

            # Libera buffers de imagem imediatamente
            del img
            del nparr
            del body

            response_json = json.dumps(result, ensure_ascii=False)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(response_json.encode('utf-8'))

        except Exception as e:
            logging.error(f"Erro ao processar OCR: {e}", exc_info=True)
            self.send_response(500)
            self._send_cors_headers()
            self.end_headers()
            err_resp = {'error': str(e)}
            self.wfile.write(json.dumps(err_resp).encode('utf-8'))

    def log_message(self, format, *args):
        # Log limpo
        logging.info("%s - %s", self.address_string(), format % args)

def run():
    server = HTTPServer((HOST, PORT), LocalOCRHandler)
    logging.info(f"Servidor OCR Local iniciado estritamente em http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Encerrando servidor OCR local...")
        server.server_close()

if __name__ == '__main__':
    run()
