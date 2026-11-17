import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 600, height: 800 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: Arial, sans-serif;
          }
          .cover {
            border: 8px solid #1e293b;
            padding: 50px 40px;
            text-align: center;
            background: #ffffff;
            width: 440px;
          }
          h1 {
            font-size: 38px;
            color: #0f172a;
            margin: 0 0 20px 0;
            letter-spacing: 2px;
          }
          h2 {
            font-size: 24px;
            color: #334155;
            margin: 0 0 40px 0;
            font-weight: normal;
          }
          p {
            font-size: 18px;
            color: #64748b;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="cover">
          <p>LIVRARIA CLASSICA</p>
          <div style="height: 40px;"></div>
          <h1>DOM CASMURRO</h1>
          <h2>MACHADO DE ASSIS</h2>
          <div style="height: 60px;"></div>
          <p>EDICAO BRASIL</p>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const coverElement = await page.$('.cover');
  const destPath = path.resolve(__dirname, '../tests/fixtures/livro-fixture.png');

  if (coverElement) {
    await coverElement.screenshot({ path: destPath });
    console.log(`[fixture] Capa real renderizada em alta definição em: ${destPath}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
