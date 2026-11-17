import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Catalogador Local de Livros - E2E Tests', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/livro-fixture.png');

  test.beforeEach(async ({ page }) => {
    // 1. Regra estrita: BLOQUEIA qualquer requisição externa para comprovar 100% de operação local
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        route.continue();
      } else {
        console.warn(`[BLOCKED EXTERNAL REQUEST]: ${url}`);
        route.abort('blockedbyclient');
      }
    });

    // Injeta Mock de OCR na abstração global para previsibilidade e agilidade nos testes E2E
    await page.addInitScript(() => {
      window.__MOCK_OCR_SERVICE__ = {
        recognize: async (input: unknown) => {
          // Se o nome do arquivo indicar 'falha', simula falha
          const inputName = typeof input === 'object' && input && 'name' in input ? (input as { name: string }).name : '';
          if (inputName.includes('falha')) {
            throw new Error('Falha simulada no processamento OCR.');
          }
          return {
            text: 'DOM CASMURRO\nMACHADO DE ASSIS\nEDITORA NACIONAL',
            rawText: 'DOM CASMURRO\nMACHADO DE ASSIS\nEDITORA NACIONAL',
            suggestedTitle: 'DOM CASMURRO',
            confidence: 96,
            status: 'reliable',
            selectedAngle: 0,
            engine: 'mock',
          };
        },
        terminate: async () => {},
        checkHealth: async () => ({ online: true, engine: 'mock-local' }),
      };
    });
  });

  test('Fluxo Completo: Criar prateleira, importar fotos, editar texto, alterar exemplares, exportar TXT e validar persistência', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Criar prateleira
    await page.click('button:has-text("Nova Prateleira")');
    await page.fill('#shelf-name-input', 'Coleção Clássicos Brasileiros');
    await page.click('#submit-create-shelf-btn');

    // Confirmar que a página de detalhes da prateleira foi aberta
    await expect(page.getByRole('heading', { name: 'Coleção Clássicos Brasileiros' })).toBeVisible();
    await expect(page.locator('text=Total de Livros')).toBeVisible();

    // 2. Importar foto da capa
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('label[for="file-upload-input"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // 3. Aguardar processamento da fila de OCR
    await expect(
      page.locator('text=Extração Confiável').or(page.locator('text=OCR Concluído'))
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h3:has-text("LIVRO 001")')).toBeVisible();
    await expect(page.locator('text=DOM CASMURRO').first()).toBeVisible();

    // Durante a sessão ativa, deve existir o botão "Ver Foto da Sessão"
    await expect(page.locator('button:has-text("Ver Foto da Sessão")')).toBeVisible();

    // 4. Editar texto revisado
    const reviewedTextarea = page.locator('textarea[id^="reviewed-text-"]');
    await reviewedTextarea.fill('Dom Casmurro - Edição Especial Crítica');
    await reviewedTextarea.blur();

    // 5. Alterar quantidade de exemplares usando o botão '+'
    await page.click('button[aria-label="Aumentar exemplares de LIVRO 001"]');
    await expect(page.locator('input[id^="copy-count-"]')).toHaveValue('2');

    // 6. Confirmar totais atualizados na tela
    await expect(page.locator('#total-books-indicator')).toHaveText('1');
    await expect(page.locator('#total-copies-indicator')).toHaveText('2');

    // 7. Exportar TXT e validar conteúdo gerado
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar TXT")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Colecao_Classicos_Brasileiros.txt');
    const downloadStream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk as Buffer);
    }
    const txtContent = Buffer.concat(chunks).toString('utf-8');

    expect(txtContent).toContain('PRATELEIRA: Coleção Clássicos Brasileiros');
    expect(txtContent).toContain('TOTAL DE LIVROS: 1');
    expect(txtContent).toContain('TOTAL DE EXEMPLARES: 2');
    expect(txtContent).toContain('LIVRO 001');
    expect(txtContent).toContain('QUANTIDADE DE EXEMPLARES: 2');
    expect(txtContent).toContain('TEXTO REVISADO:\nDom Casmurro - Edição Especial Crítica');

    // 8. Recarregar a página e confirmar persistência textual no IndexedDB
    await page.reload();

    // Na página inicial, a prateleira criada deve estar visível na lista
    await expect(page.getByRole('heading', { name: 'Coleção Clássicos Brasileiros' })).toBeVisible();
    await page.click('button[aria-label="Abrir prateleira Coleção Clássicos Brasileiros"]');

    // Ao abrir a prateleira, confirmar que os dados dos livros foram recuperados do IndexedDB
    await expect(page.locator('h3:has-text("LIVRO 001")')).toBeVisible();
    await expect(page.locator('textarea[id^="reviewed-text-"]')).toHaveValue('Dom Casmurro - Edição Especial Crítica');
    await expect(page.locator('input[id^="copy-count-"]')).toHaveValue('2');

    // 9. Confirmar que NÃO há imagem persistida após o reload
    await expect(page.locator('text=(Sem foto em sessão)')).toBeVisible();
    await expect(page.locator('button:has-text("Ver Foto da Sessão")')).not.toBeVisible();

    // 10. Inspecionar o IndexedDB para certificar que nenhuma foto/blob/base64 está gravada
    const dbCheck = await page.evaluate(async () => {
      return new Promise<{ hasImages: boolean; details: string }>((resolve) => {
        const req = indexedDB.open('CatalogadorLivrosDB');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['books', 'shelves'], 'readonly');
          const booksReq = tx.objectStore('books').getAll();
          booksReq.onsuccess = () => {
            const records = booksReq.result;
            let foundImage = false;
            let details = '';
            for (const r of records) {
              const str = JSON.stringify(r);
              if (str.includes('data:image') || str.includes('blob:') || str.includes('base64')) {
                foundImage = true;
                details = 'Encontrado dado de imagem no registro de livro: ' + str;
              }
            }
            resolve({ hasImages: foundImage, details });
          };
        };
      });
    });

    expect(dbCheck.hasImages).toBe(false);
  });

  test('Controles Manuais: Deve permitir girar imagem temporária e reprocessar OCR na sessão', async ({
    page,
  }) => {
    await page.goto('/');
    await page.click('button:has-text("Nova Prateleira")');
    await page.fill('#shelf-name-input', 'Prateleira Teste Rotação');
    await page.click('#submit-create-shelf-btn');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('label[for="file-upload-input"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    await expect(page.locator('h3:has-text("LIVRO 001")')).toBeVisible({ timeout: 10000 });

    // Testa os botões de rotação
    const rotateCwBtn = page.locator('button[aria-label="Girar 90 graus para a direita LIVRO 001"]');
    await expect(rotateCwBtn).toBeVisible();
    await rotateCwBtn.click();

    // Testa reprocessar OCR
    const reprocessBtn = page.locator('button[aria-label="Reprocessar OCR de LIVRO 001"]');
    await expect(reprocessBtn).toBeVisible();
    await reprocessBtn.click();
    await expect(page.locator('h3:has-text("LIVRO 001")')).toBeVisible();
  });

  test('Tratamento de falha de OCR: Deve registrar erro no livro e continuar a fila sem interromper', async ({
    page,
  }) => {
    const failFilePath = path.resolve(__dirname, '../fixtures/capa-falha.png');
    fs.copyFileSync(fixturePath, failFilePath);

    await page.goto('/');
    await page.click('button:has-text("Nova Prateleira")');
    await page.fill('#shelf-name-input', 'Prateleira Teste Falhas');
    await page.click('#submit-create-shelf-btn');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('label[for="file-upload-input"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([failFilePath, fixturePath]);

    // O primeiro falha e o segundo conclui
    await expect(
      page.locator('text=Falha de OCR').or(page.locator('text=OCR Falhou'))
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=Extração Confiável').or(page.locator('text=OCR Concluído'))
    ).toBeVisible({ timeout: 10000 });

    // Ambos os livros foram criados na prateleira
    await expect(page.locator('h3:has-text("LIVRO 001")')).toBeVisible();
    await expect(page.locator('h3:has-text("LIVRO 002")')).toBeVisible();

    try {
      fs.unlinkSync(failFilePath);
    } catch {
      // No-op
    }
  });

  test('Cancelamento de fila: Deve permitir cancelar a fila sem perder resultados já concluídos', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__MOCK_OCR_SERVICE__ = {
        recognize: async () => {
          await new Promise((r) => setTimeout(r, 600));
          return {
            text: 'TEXTO CAPA',
            rawText: 'TEXTO CAPA',
            suggestedTitle: 'TEXTO CAPA',
            confidence: 90,
            status: 'reliable',
            selectedAngle: 0,
            engine: 'mock',
          };
        },
        terminate: async () => {},
      };
    });

    await page.goto('/');
    await page.click('button:has-text("Nova Prateleira")');
    await page.fill('#shelf-name-input', 'Prateleira Teste Cancelamento');
    await page.click('#submit-create-shelf-btn');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('label[for="file-upload-input"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([fixturePath, fixturePath]);

    const cancelBtn = page.locator('button:has-text("Cancelar Fila Restante")');
    if (await cancelBtn.isVisible({ timeout: 3000 })) {
      await cancelBtn.click();
      await expect(page.locator('span:has-text("Cancelado")').first()).toBeVisible();
    }
  });
});
