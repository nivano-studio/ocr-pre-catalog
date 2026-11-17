import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const targetDir = path.join(projectRoot, 'public', 'tesseract');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      console.log(`[setup:ocr] Arquivo já existe: ${destPath}`);
      return resolve();
    }
    console.log(`[setup:ocr] Baixando ${url} -> ${destPath}...`);
    const file = fs.createWriteStream(destPath);
    
    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Falha no download (${response.statusCode}): ${targetUrl}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

function copyLocal(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[setup:ocr] Copiado ${path.basename(src)} -> ${dest}`);
  } else {
    console.warn(`[setup:ocr] Origem não encontrada: ${src}`);
  }
}

async function main() {
  console.log('[setup:ocr] Configurando assets locais de OCR do Tesseract.js...');

  // 1. Worker do Tesseract
  const workerSrc = path.join(projectRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
  const workerDest = path.join(targetDir, 'worker.min.js');
  copyLocal(workerSrc, workerDest);

  // 2. Core WASM do Tesseract.js-core
  const coreDir = path.join(projectRoot, 'node_modules', 'tesseract.js-core');
  if (fs.existsSync(coreDir)) {
    const files = fs.readdirSync(coreDir);
    for (const f of files) {
      if (f.endsWith('.wasm.js') || f.endsWith('.wasm')) {
        copyLocal(path.join(coreDir, f), path.join(targetDir, f));
      }
    }
  }

  // 3. Traineddata para português (por.traineddata.gz)
  // Utiliza tessdata_fast oficial 4.0.0 recomendado pelo naptha/tesseract.js
  const trainedDataUrl = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/por.traineddata.gz';
  const trainedDataDest = path.join(targetDir, 'por.traineddata.gz');

  await downloadFile(trainedDataUrl, trainedDataDest);

  console.log('[setup:ocr] Todos os assets locais de OCR foram configurados com sucesso em public/tesseract!');
}

main().catch((err) => {
  console.error('[setup:ocr] Erro ao configurar assets:', err);
  process.exit(1);
});
