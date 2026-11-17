import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gera uma imagem PNG com fonte matricial nítida otimizada para OCR impresso
function createPngWithText(outputPath, textToRender = 'LIVRO') {
  const width = 500;
  const height = 160;

  // Matriz 9 linhas x 7 colunas para caracteres legíveis e naturais
  const font = {
    'L': [
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
    ],
    'I': [
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
    ],
    'V': [
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [0,1,1,0,1,1,0],
      [0,1,1,0,1,1,0],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0],
      [0,0,0,1,0,0,0],
    ],
    'R': [
      [1,1,1,1,1,1,0],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,1,1,1,1,0],
      [1,1,1,1,1,0,0],
      [1,1,0,1,1,0,0],
      [1,1,0,0,1,1,0],
      [1,1,0,0,1,1,1],
      [1,1,0,0,0,1,1],
    ],
    'O': [
      [0,1,1,1,1,1,0],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [0,1,1,1,1,1,0],
    ],
    ' ': [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
    ]
  };

  // Fundo branco (255)
  const grid = Array.from({ length: height }, () => new Uint8Array(width).fill(255));

  const scale = 10;
  let startX = 40;
  const startY = 35;

  for (const char of textToRender.toUpperCase()) {
    const glyph = font[char] || font[' '];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 7; c++) {
        if (glyph[r][c] === 1) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const py = startY + r * scale + dy;
              const px = startX + c * scale + dx;
              if (py < height && px < width) {
                grid[py][px] = 0;
              }
            }
          }
        }
      }
    }
    startX += (7 + 2) * scale;
  }

  const rawData = Buffer.alloc(height * (width + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0;
    for (let x = 0; x < width; x++) {
      rawData[offset++] = grid[y][x];
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = crc32(toCrc);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 0;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`[fixture] Imagem PNG gerada com sucesso em: ${outputPath}`);
}

createPngWithText(path.resolve(__dirname, '../tests/fixtures/livro-fixture.png'), 'LIVRO');
