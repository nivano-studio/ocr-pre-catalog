# Relatório Técnico Oficial de Benchmark & Diagnóstico de OCR em Capas Reais

**Projeto:** Catalogador Local de Livros por OCR  
**Ambiente:** Windows PC / Localhost (`127.0.0.1`)  
**Data:** 07 de Outubro de 2026  
**Status:** Validação Aprovada (87,5% de Títulos Exatos, 100% de Orientação Correta, 0% de Tráfego Externo)

---

## 1. Resumo Executivo das Métricas

| Métrica | Pipeline Anterior (Tesseract.js Baseline) | Novo Pipeline Local (RapidOCR PP-OCRv4 ONNX) | Variação / Melhoria |
| :--- | :---: | :---: | :---: |
| **Títulos Exatos Normalizados** | **0 / 8 (0,0%)** | **7 / 8 (87,5%)** | **+87,5 pontos percentuais** |
| **Acurácia de Orientação** | 3 / 8 (37,5%) | **8 / 8 (100,0%)** | **+62,5 pontos percentuais** |
| **CER Médio (Taxa Erro Caracteres)** | **0,941 (94,1%)** | **0,097 (9,7%)** | **-89,7% de redução no erro** |
| **WER Médio (Taxa Erro Palavras)** | **0,975 (97,5%)** | **0,083 (8,3%)** | **-91,5% de redução no erro** |
| **Tempo Médio por Imagem** | 1.840 ms | 5.405 ms | Execução local robusta em CPU |
| **Persistência de Imagens** | Zero (Apenas sessão) | Zero (Apenas sessão) | Estrita conformidade |
| **Requisições de Rede Externas** | 0 (Zero) | 0 (Zero) | 100% Offline / Localhost |

---

## 2. Diagnóstico Técnico das Falhas do Pipeline Anterior

A investigação empírica contra as fotos reais em `imagens de teste/` comprovou as seguintes causas raízes da inadequação do Tesseract original:

1. **Incapacidade de Detecção e Correção de Rotação 90°/270°:**
   - 5 das 8 fotos foram capturadas em orientação horizontal (paisagem), enquanto o livro estava na vertical (exigindo rotação de 270° CW / 90° CCW).
   - O Tesseract executava em orientação fixa de 0°, gerando sequências ininteligíveis de caracteres aleatórios quando submetido a texto rotacionado a 90°.
2. **Ausência de Detecção de Regiões de Texto (Text Detection Bounding Boxes):**
   - O Tesseract padrão tenta segmentar a página inteira em blocos de texto contíguos assumindo formatação de página impressa (PSM 3). Em capas reais, fundos com piso, sofá, dedos, lombadas de outros livros e desenhos causavam ruído severo.
3. **Agrupamento Inexistente por Hierarquia de Tamanho de Fonte:**
   - O pipeline anterior pegava a primeira linha ou confiava cegamente no score global. Em capas reais, o título principal quase sempre possui a maior tipografia, enquanto subtítulos, nomes de autores, referências e logos editoriais ocupam fontes menores.
4. **Sem Normalização ou Desmembramento de Palavras:**
   - Tipografias com baixo kerning fundiam palavras sem espaço (ex: `CATECISMODA`).

---

## 3. Arquitetura da Solução Implementada

Para resolver o problema mantendo estrita fidelidade aos requisitos de conformidade (sem APIs pagas, sem nuvem, sem LLM, sem tokens e sem persistência de imagens):

1. **Motor Local RapidOCR (PaddleOCR PP-OCRv4 via ONNX Runtime em Python):**
   - **Detector de Texto (DBNet):** Localiza bounding boxes precisas para cada linha individual na capa.
   - **Classificador de Ângulo (Text Classifier):** Avalia os ângulos candidatos (0° vs 180° para retratos; 270° vs 90° para paisagens) e determina a orientação correta com 100% de precisão antes do OCR completo.
   - **Reconhecedor (SVTR/CRNN):** Reconhece caracteres em português com alta acurácia.
2. **Desmembramento Dinâmico de Palavras Concatenadas:**
   - Algoritmo de programação dinâmica (Viterbi) com vocabulário em português que desmembra palavras unidas pelo espaçamento reduzido da fonte da capa (ex: `CATECISMODA` → `CATECISMO DA`, `REDESCOBRINDOSUA` → `REDESCOBRINDO SUA`, `oexagero` → `o exagero`).
3. **Heurística de Ranqueamento de Título por Tipografia e Posição:**
   - Identifica a altura máxima de fonte (`max_h`) e seleciona as linhas de maior hierarquia visual (altura $\ge 70\%$ da máxima), descartando nomes de autores e subtítulos inferiores.
4. **Microserviço HTTP Local em `127.0.0.1:5001`:**
   - Exclusivo para localhost, processa bytes diretamente em memória RAM (`cv2.imdecode`) e desaloca os buffers imediatamente após a resposta. Nenhuma imagem é gravada em disco.
5. **Integração Frontend Híbrida (`HybridOcrService`):**
   - O frontend React se comunica prioritariamente com `http://127.0.0.1:5001/ocr`. Se o serviço Python não estiver ativo, realiza fallback seguro para o `Tesseract.js` local do navegador.
6. **Controles Manuais de Rotação e Reprocessamento:**
   - Na interface do usuário, botões de rotação manual (90° horário e anti-horário) via HTML5 Canvas em memória e reprocessamento individual de OCR sem sair da prateleira.

---

## 4. Tabela Detalhada de Resultados por Imagem

| # | Arquivo | Ângulo Exp / Det | Título Esperado (Ground Truth) | Título Sugerido (Extraído) | CER | WER | Status |
| :-: | :--- | :---: | :--- | :--- | :-: | :-: | :--- |
| **1** | `WhatsApp Image 2026-10-07 at 11.50.13.jpeg` | 0° / 0° | CATECISMO DA IGREJA CATÓLICA | CATECISMO DA IGREJA CATOLICA | 0.000 | 0.000 | **Extração Confiável** |
| **2** | `WhatsApp Image 2026-10-07 at 11.50.14 (1).jpeg` | 270° / 270° | O MEU CAFÉ ESFRIOU E EU LEMBREI DA GENTE | O MEU CAFE ESFRIOU E EU LEMBREI DA GENTE | 0.000 | 0.000 | **Extração Confiável** |
| **3** | `WhatsApp Image 2026-10-07 at 11.50.14 (2).jpeg` | 270° / 270° | REDESCOBRINDO SUA BÍBLIA | REDESCOBRINDO SUA BIBLIA | 0.000 | 0.000 | **Extração Confiável** |
| **4** | `WhatsApp Image 2026-10-07 at 11.50.14.jpeg` | 270° / 270° | Desculpe o exagero, mas não sei sentir pouco | Desculpe o exagero, mas nao sei sentir pouco | 0.000 | 0.000 | **Extração Confiável** |
| **5** | `WhatsApp Image 2026-10-07 at 11.50.15 (1).jpeg` | 270° / 270° | BNCC | BNCC | 0.000 | 0.000 | **Extração Confiável** |
| **6** | `WhatsApp Image 2026-10-07 at 11.50.15 (2).jpeg` | 0° / 0° | Leio, Escrevo e Calculo | Leio, Escrevo e Calculo | 0.000 | 0.000 | **Extração Confiável** |
| **7** | `WhatsApp Image 2026-10-07 at 11.50.15.jpeg` | 270° / 270° | O MILAGRE DA MANHÃ | O MILAGRE DA MANHA | 0.000 | 0.000 | **Extração Confiável** |
| **8** | `WhatsApp Image 2026-10-07 at 11.50.16.jpeg` | 0° / 0° | Entre Laços Matemática | LACOS | 0.773 | 0.667 | **Revisão Recomendada / Reprovado** |

---

## 5. Análise de Casos de Borda e Diagnóstico da Imagem 8

### Diagnóstico Transparente da Imagem 8 (`WhatsApp Image 2026-10-07 at 11.50.16.jpeg`):
- **Descrição da Capa:** Livro didático de Matemática do PNLD (Editora FTD).
- **Obstáculo Visual:** A palavra "Entre" não está escrita com tipografia padronizada, mas desenhada como uma fita/laço decorativo curvo, com traçado fino e entrelaçado dentro e antes da palavra "LAÇOS". Além disso, a capa apresenta uma assinatura a lápis riscada diretamente sobre o fundo e textura áspera de cimento ao fundo.
- **Resultado Obtido:** O motor detectou com precisão a tipografia dominante "LAÇOS" ($h=285\text{ px}$) e a linha "MATEMÁTICA" ($h=69\text{ px}$). A palavra decorativa entrelaçada "Entre" não gerou bounding box de texto padrão com contraste suficiente no modelo local.
- **Tratamento:** O sistema sinaliza a necessidade de revisão visual no cartão através do badge e permite que o operador insira/ajuste o texto no campo de edição em menos de 2 segundos.

---

## 6. Comprovação das Garantias de Privacidade e Conformidade

1. **Zero Persistência de Imagens:**
   - Inspecionado via teste de integração automatizado (`tests/integration/noImagePersistence.test.ts`) e teste ponta a ponta Playwright (`tests/e2e/catalogador.spec.ts`).
   - O IndexedDB (`CatalogadorLivrosDB`) armazena estritamente campos textuais: `id`, `shelfId`, `sequenceNumber`, `rawOcrText`, `suggestedTitle`, `reviewedText`, `copyCount`, `ocrStatus`, `confidence`, `selectedAngle`, `createdAt`, `updatedAt`.
   - Fotos permanecem apenas em referências voláteis da memória RAM da sessão (`Object URL` e `Blob`) e são completamente descartadas ao fechar ou recarregar o navegador.
2. **Zero Requisições Externas / Zero Tokens:**
   - O Playwright bloqueia qualquer tráfego que não seja `localhost` ou `127.0.0.1` (`route.abort('blockedbyclient')`).
   - Todos os modelos ONNX rodam em CPU localmente no computador Windows.

---

## 7. Instruções para Reprodução

### 1. Iniciar o Microserviço OCR Local:
```powershell
python scripts/ocr_server.py
```
*O serviço iniciará na porta 5001 (`http://127.0.0.1:5001`).*

### 2. Executar o Benchmark Oficial contra as 8 Fotos Reais:
```powershell
python scripts/benchmark-paddleocr.py
```
*Gera o resumo das 8 imagens e salva os dados quantitativos em `tests/fixtures/ocr-real/rapidocr-benchmark-results.json`.*

### 3. Executar a Suíte Completa de Testes Automatizados:
```powershell
# Testes unitários, de integração e fita de não-persistência
npm test

# Verificação estrita de lint
npm run lint

# Testes E2E com interceptação de rede offline
npm run test:e2e

# Build de produção do Vite
npm run build
```
