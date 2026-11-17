import os
import cv2
import json
import time
from rapidocr_onnxruntime import RapidOCR

engine = RapidOCR()

images_dir = os.path.join(os.path.dirname(__file__), '..', 'imagens de teste')
files = sorted([f for f in os.listdir(images_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

print(f"Total de imagens encontradas: {len(files)}")

def rotate_image(img, angle):
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img

for f in files:
    img_path = os.path.join(images_dir, f)
    img_orig = cv2.imread(img_path)
    h, w = img_orig.shape[:2]
    
    print(f"\n==================================================")
    print(f"Arquivo: {f} (Dimensões: {w}x{h})")
    
    best_angle = 0
    best_score = -1.0
    best_results = None
    
    for angle in [0, 90, 180, 270]:
        rotated = rotate_image(img_orig, angle)
        results, elapse = engine(rotated)
        if results:
            total_score = sum(float(r[2]) for r in results)
            # Imprime resumo por ângulo
            print(f"  Ângulo {angle:3d}° -> {len(results):2d} linhas, Score total: {total_score:.2f}")
            if total_score > best_score:
                best_score = total_score
                best_angle = angle
                best_results = results
        else:
            print(f"  Ângulo {angle:3d}° -> 0 linhas")
    
    print(f">> MELHOR ÂNGULO ESCOLHIDO: {best_angle}° (Score: {best_score:.2f})")
    if best_results:
        print(f"Linhas extraídas na melhor orientação:")
        for idx, line in enumerate(best_results):
            box, text, score = line
            print(f"   [{idx+1}] (conf: {float(score):.2f}) {text}")
    else:
        print("   Nenhum texto detectado.")
