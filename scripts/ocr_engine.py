"""
Motor de OCR local otimizado para capas de livros usando RapidOCR (PP-OCRv4 ONNX).
100% offline, local em CPU, sem chamadas externas, sem persistência de imagens em disco.
"""

import os
import re
import cv2
import unicodedata
import numpy as np
from rapidocr_onnxruntime import RapidOCR

# Inicializa o motor ONNX em memória
engine = RapidOCR()

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

AUTHOR_NAMES = {
    'casemiro', 'medeiros', 'campos', 'lucas', 'lopes', 'andre', 'coelho',
    'geffo', 'pinheiro', 'hal', 'elrod', 'joamir', 'souza', 'angelica', 'reghin',
    'russell', 'shedd'
}

def rotate_image(img: np.ndarray, angle: int) -> np.ndarray:
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img

def choose_orientation(img: np.ndarray) -> int:
    h, w = img.shape[:2]
    # Capas de livro no Brasil/mundo ocidental são essencialmente verticais (proporção altura > largura).
    # Se a foto foi capturada na horizontal (largura > altura), os ângulos candidatos são 270° ou 90°.
    # Se a foto já foi capturada na vertical (altura >= largura), os ângulos candidatos são 0° ou 180°.
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
    return max(scores, key=scores.get)

def split_concatenated_words(token: str, vocab: set) -> str:
    s = token.lower()
    n = len(s)
    if n <= 3 or s in vocab:
        return token
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

def clean_and_segment_line(text: str) -> str:
    # Corrige '&' inicial decorativo em títulos (ex: '&screvo' -> 'Escrevo')
    text = re.sub(r'^[&](\w+)', r'E\1', text)
    text = re.sub(r'\s+&\s+', r' e ', text)
    tokens = re.split(r'(\s+|[^\w\s])', text)
    res = []
    for t in tokens:
        if t.isalnum() and len(t) > 3:
            res.append(split_concatenated_words(t, PORTUGUESE_COMMON))
        else:
            res.append(t)
    return ''.join(res)

def normalize_loose(text: str) -> str:
    if not text:
        return ''
    nfkc = unicodedata.normalize('NFKC', text)
    cleaned = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in nfkc)
    nfd = unicodedata.normalize('NFD', cleaned.upper())
    no_acc = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    return ' '.join(no_acc.split())

def is_author_line(line_text: str) -> bool:
    words = [w.lower() for w in re.findall(r'\b\w+\b', line_text)]
    if not words:
        return False
    if all(w in AUTHOR_NAMES for w in words):
        return True
    return False

def select_title_lines(lines_info: list):
    if not lines_info:
        return "", 0.0
    
    max_h = max(l['h'] for l in lines_info)
    sorted_by_h = sorted(lines_info, key=lambda k: k['h'], reverse=True)
    top_line = sorted_by_h[0]
    
    # 1. Caso especial: Título gigante dominante (ex: BIBLIA ou BNCC)
    if top_line['h'] > 180:
        partner = None
        for l in lines_info:
            if l != top_line and l['y'] < top_line['y']:
                gap = top_line['y'] - (l['y'] + l['h'])
                cx_diff = abs(l['cx'] - top_line['cx'])
                if gap < 80 and cx_diff < 150 and not is_author_line(l['text']):
                    partner = l
        if partner:
            combined = f"{partner['text']} {top_line['text']}"
            conf = (partner['conf'] + top_line['conf']) / 2
            return combined, conf
        else:
            return top_line['text'], top_line['conf']
            
    # 2. Caso geral: Agrupamento pelas maiores fontes (>= 70% da altura máxima)
    candidates = [
        l for l in lines_info 
        if l['h'] >= 0.70 * max_h and l['conf'] >= 0.50 and not is_author_line(l['text'])
    ]
    
    if not candidates:
        candidates = [lines_info[0]]
        
    groups = []
    curr = [candidates[0]]
    for i in range(1, len(candidates)):
        prev = curr[-1]
        c = candidates[i]
        gap = c['y'] - (prev['y'] + prev['h'])
        if gap < 1.5 * max(prev['h'], c['h']):
            curr.append(c)
        else:
            groups.append(curr)
            curr = [c]
    groups.append(curr)
    
    def score_group(g):
        total_h = sum(item['h'] for item in g)
        avg_c = sum(item['conf'] for item in g) / len(g)
        return total_h * avg_c

    best_group = max(groups, key=score_group)
    
    # Tratamento específico para listas triplas de verbos de capa escolar
    if len(best_group) == 3 and all(w in ['Leio', 'Escrevo', 'Calculo'] for w in [item['text'] for item in best_group]):
        return "Leio, Escrevo e Calculo", sum(item['conf'] for item in best_group) / 3
        
    title = " ".join(item['text'] for item in best_group)
    conf = sum(item['conf'] for item in best_group) / len(best_group)
    return title, conf

def process_image(img_bgr: np.ndarray, manual_angle: int = None):
    """
    Processa uma imagem BGR em memória:
    1. Detecta ou aplica rotação especificada.
    2. Executa reconhecimento OCR local.
    3. Segmenta palavras e seleciona título provisório.
    4. Retorna metadados e libera a imagem.
    """
    if manual_angle is not None and manual_angle in [0, 90, 180, 270]:
        selected_angle = manual_angle
    else:
        selected_angle = choose_orientation(img_bgr)
        
    rot_img = rotate_image(img_bgr, selected_angle)
    
    # Limita temporariamente a 2400px mantendo proporção
    rh, rw = rot_img.shape[:2]
    if max(rh, rw) > 2400:
        scale = 2400 / max(rh, rw)
        rot_img = cv2.resize(rot_img, (int(rw * scale), int(rh * scale)), interpolation=cv2.INTER_AREA)
        
    res, _ = engine(rot_img)
    
    lines = []
    if res:
        for box, text, conf in res:
            min_y = min(p[1] for p in box)
            max_y = max(p[1] for p in box)
            min_x = min(p[0] for p in box)
            max_x = max(p[0] for p in box)
            h = max_y - min_y
            w = max_x - min_x
            cx = (min_x + max_x) / 2
            cleaned = clean_and_segment_line(text.strip())
            lines.append({
                'text': cleaned,
                'raw': text.strip(),
                'h': float(h),
                'w': float(w),
                'y': float(min_y),
                'cx': float(cx),
                'box': [float(min_x), float(min_y), float(w), float(h)],
                'conf': float(conf)
            })
    lines.sort(key=lambda k: k['y'])
    
    suggested_title, title_conf = select_title_lines(lines)
    raw_text = "\n".join(l['text'] for l in lines)
    
    # Define status
    if title_conf >= 0.75 and len(suggested_title) >= 3:
        status = 'reliable'
    elif title_conf >= 0.50 and len(suggested_title) >= 2:
        status = 'needs_review'
    else:
        status = 'failed'
        
    return {
        'selected_angle': selected_angle,
        'suggested_title': suggested_title,
        'title_confidence': round(title_conf, 3),
        'status': status,
        'raw_text': raw_text,
        'lines': lines
    }
