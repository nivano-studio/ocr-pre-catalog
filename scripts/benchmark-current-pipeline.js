import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const imagesDir = path.join(projectRoot, 'imagens de teste');
const tessdataPath = path.join(projectRoot, 'public', 'tesseract');

async function benchmarkCurrent() {
  console.log('=== DIAGNÓSTICO E BENCHMARK DO PIPELINE ATUAL (TESSERACT PURO) ===');
  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png'));

  const worker = await createWorker('por', 1, {
    langPath: tessdataPath,
    gzip: true,
  });

  const results = [];

  for (const file of files) {
    const fullPath = path.join(imagesDir, file);
    console.log(`\nProcessando: ${file}...`);
    const startTime = Date.now();
    try {
      const { data } = await worker.recognize(fullPath);
      const elapsed = Date.now() - startTime;
      const text = data.text ? data.text.trim() : '';
      console.log(`Tempo: ${elapsed}ms | Confiança: ${data.confidence}%`);
      console.log(`Texto extraído (primeiras 5 linhas):\n${text.split('\n').slice(0, 5).join('\n')}`);
      results.push({
        file,
        elapsed,
        confidence: data.confidence,
        linesCount: data.lines ? data.lines.length : 0,
        rawText: text,
      });
    } catch (err) {
      console.error(`Erro ao processar ${file}:`, err);
      results.push({ file, error: err.message });
    }
  }

  await worker.terminate();

  const outJson = path.join(projectRoot, 'tests', 'fixtures', 'ocr-real', 'current-pipeline-results.json');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nResultados do pipeline atual salvos em: ${outJson}`);
}

benchmarkCurrent().catch(err => {
  console.error(err);
  process.exit(1);
});
