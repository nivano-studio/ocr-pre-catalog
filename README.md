# Catalogador Local de Livros por OCR

Aplicação web local (Windows/PC) para catalogação preliminar de livros a partir de fotos individuais das capas via OCR estritamente local (Tesseract.js/WASM), sem tokens de IA, sem LLMs, sem APIs pagas de visão e sem qualquer tráfego externo de fotos ou textos.

---

## 1. Requisitos do Sistema

- **Sistema Operacional:** Windows 10 ou 11 (Desktop/PC).
- **Node.js:** Versão 18+ (recomendado Node.js 20 ou 24 LTS).
- **Navegador Moderno:** Google Chrome, Microsoft Edge ou Firefox com suporte a WebAssembly (WASM), Web Workers e IndexedDB.

---

## 2. Instalação e Configuração dos Assets Locais

1. Instalar as dependências do projeto:
   ```bash
   npm install
   ```

2. Baixar e preparar os assets locais de OCR do Tesseract.js (executado uma única vez durante o setup):
   ```bash
   npm run setup:ocr
   ```
   *Este comando copia o `worker.min.js`, bibliotecas WebAssembly (`tesseract-core*.wasm.js`) e baixa o arquivo de modelo em português (`por.traineddata.gz`) diretamente para a pasta pública `public/tesseract/`. Durante o uso da aplicação, nenhum dado ou modelo é baixado da rede.*

3. Instalar o navegador para testes E2E do Playwright:
   ```bash
   npx playwright install chromium
   ```

---

## 3. Execução da Aplicação

### Modo de Desenvolvimento
```bash
npm run dev
```
Acesse localmente em seu navegador no endereço: `http://localhost:5173`.

### Compilação de Produção e Visualização
```bash
npm run build
npm run preview
```

---

## 4. Garantia Rigorosa de Privacidade e Operação Local

- **Sem envio externo:** A aplicação não utiliza OpenAI, Google Gemini, Claude, AWS Textract, Google Cloud Vision, Azure Vision ou qualquer serviço na nuvem.
- **Assets 100% Locais:** O Tesseract.js foi configurado para resolver seus arquivos de Worker, WASM e dados de linguagem (`por.traineddata.gz`) exclusivamente a partir do diretório `/tesseract/` do servidor local.
- **Sem persistência permanente de imagens:**
  - Nenhuma foto, arquivo original, Base64, thumbnail ou Blob é salvo no banco de dados (`IndexedDB`), `localStorage` ou em disco.
  - O `IndexedDB` persiste exclusivamente: ID da prateleira, nome, datas, ID do livro, ordem sequencial (`sequenceNumber`), texto OCR bruto, texto revisado pelo usuário, quantidade de exemplares, status e mensagem de erro do OCR.
  - Durante a sessão ativa, as fotos importadas utilizam `Object URL` mantidas apenas na memória RAM da aba do navegador. Ao fechar a aba ou recarregar a página, essas referências são liberadas e descartadas.

---

## 5. Limitações Reais do OCR Local

1. **Apenas Extração de Texto Visível:** O OCR local com Tesseract.js extrai o texto que consegue identificar na imagem da capa. Ele **não** infere nem identifica estruturadamente o que é Título, Autor, Editora, Edição ou ISBN. Essa estruturação e refinamento bibliográfico devem ser feitos manualmente pelo usuário através do campo "Texto Revisado" ou por processo posterior.
2. **Capas Artísticas e Tipografias Complexas:** Capas com tipografias ornamentadas, fontes manuscritas, baixo contraste de fundo, sombras ou fotos inclinadas podem gerar ruídos, caracteres truncados ou erros de pontuação.
3. **Consumo de CPU Local:** O OCR roda em Web Worker no seu computador. Embora não trave a interface, processamentos de dezenas de imagens usam o processador da máquina local. Por isso, a aplicação processa estritamente **uma imagem por vez** de forma sequencial.

---

## 6. Arquitetura do Software

- `src/domain/`: Regras de negócio puras (validação de prateleira, contagem de exemplares, limites e validação de lotes, regras de transição de fila, exportação e validação de TXT, sanitização de arquivos).
- `src/storage/`: Camada de persistência local via `Dexie` (IndexedDB) com garantia estrita de não salvar mídias.
- `src/services/`: Abstração de OCR (`IOcrService`, `TesseractOcrService`, `MockOcrService`) e pré-processamento de imagem (`imagePreprocessor.ts` - orientação, limite de 2400px no maior lado e descarte de recursos).
- `src/components/`: Componentes visuais em React com Tailwind CSS, focados em usabilidade de PC e acessibilidade (labels explícitos, navegação por teclado, foco visível, contraste adequado).

---

## 7. Bateria de Testes

- **Testes Unitários:**
  ```bash
  npm run test:unit
  ```
  Testa validação de prateleiras, exemplares, cálculos de totais, validação de arquivos e limites, transições de status da fila, formatação e sanitização de TXT.

- **Testes de Integração:**
  ```bash
  npm run test:integration
  ```
  Testa persistência no IndexedDB, criação/edição/exclusão em cascata e verificação de que nenhuma imagem ou dado binário foi persistido.

- **Smoke Test com OCR Real:**
  ```bash
  npm run test:smoke
  ```
  Executa o Tesseract.js real contra uma imagem de fixture local (`tests/fixtures/livro-fixture.png`) e comprova o reconhecimento offline sem chamadas externas.

- **Testes End-to-End (E2E) com Playwright:**
  ```bash
  npm run test:e2e
  ```
  Testa o fluxo completo do usuário no navegador: criação de prateleira, importação, fila sequencial, edição de texto, ajuste de quantidade, exportação de TXT, recarregamento da página com retenção de dados e descarte de fotos de sessão, tolerância a falhas na fila e bloqueio total de conexões de rede externas.

- **Linter e Typecheck:**
  ```bash
  npm run lint
  npm run build
  ```
"# ocr-pre-catalog" 
