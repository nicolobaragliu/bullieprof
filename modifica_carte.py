#!/usr/bin/env python3
"""
Modifica testi carte fisiche Bulli e Prof.
Uso: python3 modifica_carte.py <input.png> <output.png> --carta <nome>
     oppure: python3 modifica_carte.py --batch  (processa tutte le carte configurate)
"""

from PIL import Image, ImageDraw, ImageFont
import sys, os, textwrap, argparse

FONT_PATH = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
TESTO_COLORE = (25, 25, 35)
OUT_DIR = "carte_modificate"

# ─── CAMPIONA COLORE SFONDO ───────────────────────────────────────────────────
def campiona_sfondo(img, x1, y1, x2, y2, margin=15):
    """Campiona il colore di sfondo da un punto pulito dentro il box."""
    px = img.load()
    # Prende un punto ben dentro i bordi, lontano dai margini
    sx = x1 + margin + (x2 - x1 - 2*margin) // 4
    sy = y1 + margin + (y2 - y1 - 2*margin) // 4
    return px[sx, sy]

# ─── CANCELLA AREA TESTO ──────────────────────────────────────────────────────
def cancella_area(draw, img, x1, y1, x2, y2, margin=8):
    """Riempie l'area con il colore di sfondo campionato."""
    colore = campiona_sfondo(img, x1, y1, x2, y2, margin)
    draw.rectangle([x1 + margin, y1 + margin, x2 - margin, y2 - margin], fill=colore)
    return colore

# ─── SCRIVI TESTO CENTRATO ────────────────────────────────────────────────────
def scrivi_testo(draw, testo, x1, y1, x2, y2, font_size=None, colore=TESTO_COLORE, interlinea=1.35):
    """Scrive testo centrato nel box, adattando font_size se non specificato."""
    larghezza = x2 - x1
    altezza = y2 - y1

    # Prova dimensioni font dal grande al piccolo
    for size in ([font_size] if font_size else range(52, 18, -2)):
        font = ImageFont.truetype(FONT_PATH, size)
        # Calcola wrap ottimale
        char_w = font.getlength("n")
        chars_per_line = max(10, int(larghezza * 0.88 / char_w))
        righe = textwrap.wrap(testo, width=chars_per_line)
        line_h = size * interlinea
        total_h = len(righe) * line_h
        if total_h <= altezza * 0.88:
            break

    # Disegna ogni riga centrata verticalmente
    start_y = y1 + (altezza - total_h) / 2
    for i, riga in enumerate(righe):
        bbox = font.getbbox(riga)
        w = bbox[2] - bbox[0]
        x = x1 + (larghezza - w) / 2
        y = start_y + i * line_h
        draw.text((x, y), riga, font=font, fill=colore)

# ─── MODIFICA SINGOLA CARTA ───────────────────────────────────────────────────
def modifica_carta(input_path, output_path, carta_id):
    img = Image.open(input_path).convert("RGBA")
    # Lavora su copia RGBA per preservare trasparenza, poi converti per salvataggio
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)  # disegna direttamente sull'immagine

    W, H = img.size
    print(f"  Carta '{carta_id}': {W}x{H}px")

    if carta_id == "leccapiedi":
        # Box testo in basso: zona crema/bianca con il testo del ruolo
        # Coordinate da calibrare sull'originale — stima iniziale per carta portrait ~1300x2000
        # Il box testo è circa: x dal 7% al 93%, y dall'80% al 97%
        x1, y1 = int(W * 0.07), int(H * 0.785)
        x2, y2 = int(W * 0.93), int(H * 0.975)
        cancella_area(draw, img, x1, y1, x2, y2)
        scrivi_testo(draw,
            "Giochi con i buoni ma vinci anche tu se i bulli vincono. I bulli non sanno chi sei.",
            x1, y1, x2, y2)

    elif carta_id == "prof_religione_m" or carta_id == "prof_religione_f":
        x1, y1 = int(W * 0.07), int(H * 0.785)
        x2, y2 = int(W * 0.93), int(H * 0.975)
        cancella_area(draw, img, x1, y1, x2, y2)
        scrivi_testo(draw,
            "Una volta per partita, al mattino dopo l'annuncio del Preside, puoi resuscitare un giocatore eliminato la notte scorsa. Se era un bullo, diventa Bullo Pentito.",
            x1, y1, x2, y2)

    elif carta_id == "prof_robotica":
        x1, y1 = int(W * 0.07), int(H * 0.785)
        x2, y2 = int(W * 0.93), int(H * 0.975)
        cancella_area(draw, img, x1, y1, x2, y2)
        scrivi_testo(draw,
            "Se vieni eliminato di notte, i bulli sabotano il voto: la votazione diurna di quel giorno viene annullata.",
            x1, y1, x2, y2)

    elif carta_id == "bidello":
        x1, y1 = int(W * 0.07), int(H * 0.785)
        x2, y2 = int(W * 0.93), int(H * 0.975)
        cancella_area(draw, img, x1, y1, x2, y2)
        scrivi_testo(draw,
            "Di notte spii un giocatore. Il Preside ti dice se è un bullo o un innocente.",
            x1, y1, x2, y2)

    elif carta_id in ("prof_motoria_m", "prof_motoria_f"):
        # Carta landscape — il box testo è nella metà sinistra
        # Per landscape ~2000x1300: box circa x 7%-72%, y 70%-97%
        x1, y1 = int(W * 0.07), int(H * 0.70)
        x2, y2 = int(W * 0.72), int(H * 0.97)
        cancella_area(draw, img, x1, y1, x2, y2)
        scrivi_testo(draw,
            "Siete in coppia! Una volta per partita attivate i Campionati: i bulli non eliminano nessuno quella notte.",
            x1, y1, x2, y2)

    else:
        print(f"  ⚠️  Carta '{carta_id}' non configurata. Nessuna modifica.")
        return False

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    # Salva come PNG per massima qualità
    img.convert("RGB").save(output_path, "PNG", dpi=(300, 300))
    print(f"  ✅ Salvata: {output_path}")
    return True

# ─── CALIBRAZIONE: mostra griglia sull'immagine per trovare coordinate box ───
def calibra(input_path, output_path):
    """Disegna una griglia % sull'immagine per trovare le coordinate del box testo."""
    img = Image.open(input_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    W, H = img.size
    # Griglia ogni 5%
    for pct in range(5, 100, 5):
        x = int(W * pct / 100)
        y = int(H * pct / 100)
        draw.line([(x, 0), (x, H)], fill=(255, 0, 0, 128), width=1)
        draw.line([(0, y), (W, y)], fill=(255, 0, 0, 128), width=1)
        try:
            font = ImageFont.truetype(FONT_PATH, 20)
            draw.text((x+2, 2), f"{pct}%", font=font, fill=(255, 0, 0))
            draw.text((2, y+2), f"{pct}%", font=font, fill=(255, 0, 0))
        except:
            pass
    img.save(output_path)
    print(f"Griglia salvata: {output_path}")

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", help="File PNG input")
    parser.add_argument("output", nargs="?", help="File PNG output")
    parser.add_argument("--carta", help="ID carta (es: leccapiedi, prof_religione_m, ...)")
    parser.add_argument("--calibra", action="store_true", help="Modalità calibrazione: disegna griglia %")
    args = parser.parse_args()

    if args.calibra and args.input and args.output:
        calibra(args.input, args.output)
    elif args.input and args.output and args.carta:
        modifica_carta(args.input, args.output, args.carta)
    else:
        print("Uso:")
        print("  python3 modifica_carte.py input.png output.png --carta leccapiedi")
        print("  python3 modifica_carte.py input.png griglia.png --calibra")
        print()
        print("Carte supportate:")
        carte = ["leccapiedi", "prof_religione_m", "prof_religione_f",
                 "prof_robotica", "bidello", "prof_motoria_m", "prof_motoria_f"]
        for c in carte: print(f"  - {c}")
