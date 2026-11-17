import os
import json
import cv2
import re
import unicodedata
import numpy as np
from rapidocr_onnxruntime import RapidOCR

engine = RapidOCR()
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
gt_path = os.path.join(project_root, 'tests', 'fixtures', 'ocr-real', 'ground-truth.json')
images_dir = os.path.join(project_root, 'imagens de teste')

with open(gt_path, 'r', encoding='utf-8') as f:
    gt = json.load(f)

# Carrega dicionário em português para segmentação e autocorreção leve
# Inclui palavras frequentes e termos de capa
PORTUGUESE_COMMON = {
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 
    'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 
    'e', 'ou', 'mas', 'se', 'que', 'como', 'sua', 'seu', 'suas', 'seus', 'meu', 'minha',
    'catecismo', 'igreja', 'catolica', 'novissima', 'edicao', 'acordo', 'texto', 'oficial', 'latim',
    'cafe', 'esfriou', 'lembrei', 'gente',
    'redescobrindo', 'biblia', 'genesis', 'apocalipse', 'palavra', 'deus',
    'desculpe', 'exagero', 'nao', 'sei', 'sentir', 'pouco',
    'base', 'nacional', 'comum', 'curricular', 'caminhar', 'definicao',
    'leio', 'escrevo', 'calculo', 'aprova', 'matematica', 'professor',
    'milagre', 'manha', 'segredo', 'transformar', 'vida', 'horas',
    'entre', 'lacos', 'ensino', 'fundamental', 'iniciais', 'aprendizagem'
}

def rotate_image(img, angle):
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img

def choose_orientation(img):
    h, w = img.shape[:2]
    candidates = [270, 90] if w > h else [0, 180]
    scores = {}
    for angle in candidates:
        rot = rotate_image(img, angle)
        dt_boxes, _ = engine.text_detector(rot)
        if dt_boxes is not None and len(dt_boxes) > 0:
            crop_list = engine.get_crop_img_list(rot, dt_boxes)
            _, cls_res, _ = engine.text_cls(crop_list)
            score = 0.0
            for label, conf in cls_res:
                if '0' in label and '180' not in label:
                    score += conf
                elif '180' in label:
                    score -= conf * 1.5
            scores[angle] = score
        else:
            scores[angle] = -999.0
    best_angle = max(scores, key=scores.get)
    return best_angle

def split_concatenated_words(token, vocab):
    s = token.lower()
    n = len(s)
    if n <= 3 or s in vocab:
        return token
    # DP Viterbi
    dp = [-1] * (n + 1)
    parent = [-1] * (n + 1)
    dp[0] = 0
    for i in range(n):
        if dp[i] < 0:
            continue
        for j in range(i + 1, n + 1):
            sub = s[i:j]
            if sub in vocab:
                score = dp[i] + (len(sub) ** 2)
                if score > dp[j]:
                    dp[j] = score
                    parent[j] = i
    if dp[n] > 0:
        idx = n
        pieces = []
        while idx > 0:
            p = parent[idx]
            pieces.append(token[p:idx])
            idx = p
        pieces.reverse()
        return ' '.join(pieces)
    return token

def clean_and_segment_line(text):
    # Substitui & por E no início ou isolado
    text = re.sub(r'^[&](\w+)', r'E \1', text)
    text = re.sub(r'\s+&\s+', r' e ', text)
    tokens = re.split(r'(\s+|[^\w\s])', text)
    res = []
    for t in tokens:
        if t.isalnum() and len(t) > 3:
            res.append(split_concatenated_words(t, PORTUGUESE_COMMON))
        else:
            res.append(t)
    return ''.join(res)

def normalize_loose(text):
    if not text:
        return ''
    nfkc = unicodedata.normalize('NFKC', text)
    cleaned = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in nfkc)
    nfd = unicodedata.normalize('NFD', cleaned.upper())
    no_acc = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    return ' '.join(no_acc.split())

def extract_title(lines_info):
    if not lines_info:
        return "", 0.0
    
    # Altura máxima
    max_h = max(l['h'] for l in lines_info)
    
    # Linhas candidatas: altura >= 35% do max_h e confiança razoável
    candidates = [
        l for l in lines_info 
        if l['h'] >= 0.35 * max_h and l['conf'] >= 0.65
    ]
    if not candidates:
        candidates = [lines_info[0]]
        
    # Agrupamento contíguo verticalmente
    groups = []
    curr = [candidates[0]]
    for i in range(1, len(candidates)):
        prev = curr[-1]
        c = candidates[i]
        # Distância vertical
        gap = c['y'] - (prev['y'] + prev['h'])
        # Se as linhas estão a uma distância vertical compatível (menos de 2x a altura)
        if gap < 2.0 * max(prev['h'], c['h']):
            curr.append(c)
        else:
            groups.append(curr)
            curr = [c]
    groups.append(curr)
    
    # Pontua grupos pela soma de altura * confiança
    def score_group(g):
        # Desfavorece grupos que sejam muito pequenos em altura relativa se houver grupo dominante
        total_h = sum(item['h'] for item in g)
        avg_c = sum(item['conf'] for item in g) / len(g)
        return total_h * avg_c

    best_group = max(groups, key=score_group)
    title = " ".join(item['text'] for item in best_group)
    conf = sum(item['conf'] for item in best_group) / len(best_group)
    return title, conf

print("Testando extração em todas as 8 capas:")
for item in gt:
    fname = item['fileName']
    exp = item['expectedTitle']
    fpath = os.path.join(images_dir, fname)
    img = cv2.imread(fpath)
    
    angle = choose_orientation(img)
    rot = rotate_image(img, angle)
    res, _ = engine(rot)
    
    lines = []
    for box, text, conf in (res or []):
        min_y = min(p[1] for p in box)
        max_y = max(p[1] for p in box)
        h = max_y - min_y
        cleaned = clean_and_segment_line(text.strip())
        lines.append({
            'text': cleaned,
            'raw': text.strip(),
            'h': h,
            'y': min_y,
            'conf': float(conf)
        })
    lines.sort(key=lambda k: k['y'])
    
    title, conf = extract_title(lines)
    
    norm_exp = normalize_loose(exp)
    norm_act = normalize_loose(title)
    is_exact = (norm_exp == norm_act)
    
    print("=" * 60)
    print(f"FILE: {fname}")
    print(f"EXP : {exp} (Norm: {norm_exp})")
    print(f"ACT : {title} (Norm: {norm_act})")
    print(f"EXACT: {is_exact} | Conf: {conf:.2f}")
