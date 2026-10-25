"""
Gera sitemap.xml a partir de data/catalog.json: python tools/gerar_sitemap.py

Rode de novo sempre que incluir ou remover versões, ou ao trocar operation.siteUrl.
"""
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
base = catalog["operation"]["siteUrl"].rstrip("/")
lastmod = catalog["meta"]["updatedAt"]
def has_photo(v):
    return any(i.get("src") for i in [*v.get("images", []), *(img for c in v.get("colors", []) for img in c["images"])])


# Mesma regra do site: versão sem foto não é publicada (a menos que "published": true).
published = [v for v in catalog["vehicles"] if v.get("published") is True or (v.get("published") is not False and has_photo(v))]
urls = [f"{base}/", *(f"{base}/veiculo.html?v={v['id']}" for v in published), f"{base}/privacidade.html", f"{base}/termos.html"]
lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
lines += [f"  <url><loc>{escape(u)}</loc><lastmod>{lastmod}</lastmod></url>" for u in urls]
lines.append("</urlset>")
(ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"sitemap.xml com {len(urls)} endereços")
