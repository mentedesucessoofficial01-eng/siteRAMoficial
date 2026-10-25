"""
Extrai os frames da sequência da Night Edition e gera frames/manifest.json.

Uso:
    python tools/extrair_frames.py caminho/do/video.mp4 [--frames 220] [--width 1920] [--quality 80]

Requer ffmpeg e ffprobe no PATH. O site detecta o manifest sozinho: não é
preciso mudar nenhum HTML ou JS depois de rodar este script.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frames"


def probe(video: Path) -> dict:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_frames:format=duration",
        "-of", "json", str(video),
    ]
    data = json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)
    stream = data["streams"][0]
    num, den = stream["r_frame_rate"].split("/")
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": float(num) / float(den),
        "duration": float(data["format"]["duration"]),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("--frames", type=int, default=None, help="quantidade alvo de frames (150 a 300)")
    ap.add_argument("--width", type=int, default=1920, help="largura máxima (padrão 1920)")
    ap.add_argument("--quality", type=int, default=80, help="qualidade WebP (padrão 80)")
    args = ap.parse_args()

    if not args.video.exists():
        print(f"Vídeo não encontrado: {args.video}", file=sys.stderr)
        return 1
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            print(f"{tool} não está no PATH.", file=sys.stderr)
            return 1

    info = probe(args.video)
    d = info["duration"]
    # Regra da skill: curto = fps original (máx. ~300); médio = 10–15 fps; longo = 5–10 fps.
    if args.frames:
        fps = args.frames / d
    elif d < 10:
        fps = min(info["fps"], 300 / d)
    elif d <= 30:
        fps = max(10, min(15, 240 / d))
    else:
        fps = max(5, min(10, 240 / d))
    width = min(args.width, info["width"])
    width -= width % 2

    if OUT.exists():
        for f in OUT.glob("frame_*.webp"):
            f.unlink()
    OUT.mkdir(exist_ok=True)

    print(f"{info['width']}x{info['height']} · {info['fps']:.2f} fps · {d:.1f}s → extraindo a {fps:.2f} fps, largura {width}px")
    subprocess.run([
        "ffmpeg", "-v", "error", "-stats", "-i", str(args.video),
        "-vf", f"fps={fps:.4f},scale={width}:-2",
        "-c:v", "libwebp", "-quality", str(args.quality),
        str(OUT / "frame_%04d.webp"),
    ], check=True)

    count = len(list(OUT.glob("frame_*.webp")))
    manifest = {
        "count": count,
        "dir": "frames",
        "pattern": "frame_%04d.webp",
        "width": width,
        "source": args.video.name,
        "bg": "#040405",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.glob("frame_*.webp")) / 1_048_576
    print(f"{count} frames ({size:.1f} MB) em {OUT}. manifest.json atualizado.")
    if count > 300:
        print("Aviso: mais de 300 frames. Considere --frames 220 para o celular.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
