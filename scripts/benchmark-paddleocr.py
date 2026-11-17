import os
import json
import time
import unicodedata
import requests

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
images_dir = os.path.join(project_root, 'imagens de teste')
ground_truth_path = os.path.join(project_root, 'tests', 'fixtures', 'ocr-real', 'ground-truth.json')
SERVER_URL = 'http://127.0.0.1:5001/ocr'

with open(ground_truth_path, 'r', encoding='utf-8') as f:
    ground_truth = json.load(f)

def normalize_text_strict(text):
    if not text:
        return ""
    nfkc = unicodedata.normalize('NFKC', text)
    cleaned = "".join(c if c.isalnum() or c.isspace() else " " for c in nfkc)
    return " ".join(cleaned.upper().split())

def normalize_text_loose(text):
    if not text:
        return ""
    strict = normalize_text_strict(text)
    nfd = unicodedata.normalize('NFD', strict)
    return "".join(c for c in nfd if unicodedata.category(c) != 'Mn')

def compute_levenshtein(s1, s2):
    if len(s1) < len(s2):
        return compute_levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def calculate_cer(expected, actual):
    exp_norm = normalize_text_loose(expected)
    act_norm = normalize_text_loose(actual)
    if not exp_norm:
        return 0.0 if not act_norm else 1.0
    dist = compute_levenshtein(exp_norm, act_norm)
    return round(dist / max(len(exp_norm), 1), 4)

def calculate_wer(expected, actual):
    exp_words = normalize_text_loose(expected).split()
    act_words = normalize_text_loose(actual).split()
    if not exp_words:
        return 0.0 if not act_words else 1.0
    dist = compute_levenshtein(exp_words, act_words)
    return round(dist / max(len(exp_words), 1), 4)

def run_benchmark():
    print("=" * 80)
    print("BENCHMARK OFICIAL DE OCR LOCAL CONTRA O CORPUS DE 8 IMAGENS REAIS")
    print(f"Servidor: {SERVER_URL}")
    print("=" * 80)
    
    results = []
    
    for item in ground_truth:
        fname = item['fileName']
        fpath = os.path.join(images_dir, fname)
        exp_title = item['expectedTitle']
        correct_angle = item['correctOrientationDegrees']
        
        with open(fpath, 'rb') as img_f:
            img_bytes = img_f.read()
            
        t0 = time.time()
        resp = requests.post(SERVER_URL, data=img_bytes, headers={'Content-Type': 'application/octet-stream'}, timeout=60)
        elapsed = round((time.time() - t0) * 1000, 1)
        
        if resp.status_code != 200:
            print(f"ERRO em {fname}: {resp.status_code} - {resp.text}")
            continue
            
        data = resp.json()
        act_title = data['suggested_title']
        cer = calculate_cer(exp_title, act_title)
        wer = calculate_wer(exp_title, act_title)
        
        exact_strict = normalize_text_strict(exp_title) == normalize_text_strict(act_title)
        exact_loose = normalize_text_loose(exp_title) == normalize_text_loose(act_title)
        
        if exact_loose and data['title_confidence'] >= 0.75:
            eval_status = 'extração confiável'
        elif exact_loose or (cer <= 0.35 and wer <= 0.50):
            eval_status = 'revisão recomendada'
        else:
            eval_status = 'reprovado'
            
        res_record = {
            'file': fname,
            'expected_title': exp_title,
            'suggested_title': act_title,
            'expected_angle': correct_angle,
            'selected_angle': data['selected_angle'],
            'angle_correct': data['selected_angle'] == correct_angle,
            'cer': cer,
            'wer': wer,
            'exact_match': exact_loose,
            'exact_strict': exact_strict,
            'confidence': data['title_confidence'],
            'duration_ms': elapsed,
            'status': eval_status,
            'server_status': data['status'],
            'raw_text': data['raw_text']
        }
        results.append(res_record)
        
        print(f"\n[ARQUIVO]: {fname}")
        print(f"  Ângulo esperado: {correct_angle}° | Ângulo detectado: {data['selected_angle']}° (Acertou: {res_record['angle_correct']})")
        print(f"  Título Esperado : {exp_title}")
        print(f"  Título Sugerido : {act_title}")
        print(f"  CER: {cer:.3f} | WER: {wer:.3f} | Exato: {exact_loose} | Conf: {res_record['confidence']} | Status: {eval_status} ({elapsed}ms)")
        
    total = len(results)
    exact_count = sum(1 for r in results if r['exact_match'])
    angle_correct_count = sum(1 for r in results if r['angle_correct'])
    avg_cer = round(sum(r['cer'] for r in results) / total, 3)
    avg_wer = round(sum(r['wer'] for r in results) / total, 3)
    avg_time = round(sum(r['duration_ms'] for r in results) / total, 1)
    
    print("\n" + "=" * 80)
    print("RESUMO CONSOLIDADO DAS MÉTRICAS")
    print("=" * 80)
    print(f"Total de Imagens      : {total}")
    print(f"Orientação Correta    : {angle_correct_count} / {total} ({angle_correct_count/total*100:.1f}%)")
    print(f"Títulos Exatos        : {exact_count} / {total} ({exact_count/total*100:.1f}%)")
    print(f"CER Médio             : {avg_cer}")
    print(f"WER Médio             : {avg_wer}")
    print(f"Tempo Médio por Foto  : {avg_time} ms")
    print("=" * 80)
    
    out_path = os.path.join(project_root, 'tests', 'fixtures', 'ocr-real', 'rapidocr-benchmark-results.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Resultados salvos em: {out_path}")

if __name__ == '__main__':
    run_benchmark()
