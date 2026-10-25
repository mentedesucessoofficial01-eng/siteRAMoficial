# Plataforma RAM: "Luz de sódio"

Projeto de portfólio: site comercial para picapes RAM. Inclui:

- vitrine com setas laterais e troca de cor;
- sequência da Night Edition guiada pelo scroll;
- catálogo filtrável;
- simulador de parcelas;
- localizador de unidades;
- pedido de proposta por WhatsApp, com a origem de cada clique.

Front-end estático (HTML, CSS e JavaScript, sem build). Todos os dados ficam em **um arquivo**: `data/catalog.json`.

> **Portfólio.** As imagens e os vídeos são ilustrativos (gerados por IA, de propriedade do autor) e aparecem com o selo "Imagem ilustrativa". Nenhum preço é publicado: os cards mostram "Consulte condições". As unidades são fictícias. O site não se apresenta como RAM nem como concessionária.

---

## Como rodar

```bash
python tools/servir.py        # http://127.0.0.1:8000
```

O site precisa ser servido por HTTP: abrir `index.html` direto pelo arquivo não carrega o catálogo nem os frames.

## Conceito

A picape à noite, iluminada por um único poste de luz de sódio.

- **Cores.** A base é carvão e grafite, com off-white para leitura. O laranja de lâmpada de sódio (`#ff6b1a`) fica reservado ao que é comercial: preços e botões de ação.
- **Tipografia.** Big Shoulders Display, condensada, nos títulos; Archivo no texto corrido; IBM Plex Mono nos dados técnicos.
- **Visual.** Sem cartões de vidro e sem carrossel automático.

## Ordem da home (versão portfólio, enxuta)

O site mostra a qualidade dos efeitos, das imagens e do texto; ele não pretende vender picapes. Por isso ficaram só três versões com imagem certeira:

- **RAM 3500 Laramie Night Edition** (destaque);
- **RAM 3500 Laramie**, com troca entre branco e vermelho;
- **RAM 1500 Laramie**, em cinza.

1. **Abertura.** Título grande e o botão "Falar com consultor".
2. **Sequência Night Edition guiada pelo scroll.** Os frames do vídeo acompanham a rolagem, com textos laterais, contadores e letreiro. Termina com o CTA "Quero saber o preço".
3. **Vitrine.** Setas laterais, deslizar no celular, troca de cor e "Ver em movimento".
4. **Destaque Night Edition.** Vídeo da grade, frase curta, galeria e CTA.
5. **Proposta.** Formulário de três campos que abre o WhatsApp direto ao enviar.
6. **Rodapé.**

Catálogo com filtros, simulador, perfis de comprador, regras de ofertas e unidades foram retirados da home. O código desses módulos continua em `js/` (`catalog.js`, `simulator.js`, `dealers.js`) para um projeto de concessionária real. As outras versões continuam no cadastro com `"published": false`.

## WhatsApp e análise de conversão

Todos os botões vão para **(45) 99107-5234** (`operation.whatsapp`).

- **Botões gerais** (cabeçalho, CTA do topo, rodapé, condições): usam o texto do portfólio, em `operation.whatsappMessage`.
- **Botões de cada picape:** mandam uma mensagem com modelo, versão, ano, cor escolhida e a oferta (quando houver).
- **Formulário:** envia o pedido completo, com nome, WhatsApp, cidade, perfil, versão e cor.
- **Só WhatsApp:** o site não pede e-mail nem oferece ligação. Os cards das unidades também têm um botão de WhatsApp (origem `unidade`).

Cada mensagem termina com **`(ref: origem)`**. Assim você vê no próprio WhatsApp de onde veio cada contato:

| Origem | Onde fica |
|---|---|
| `cabecalho` | Botão fixo do topo, em todas as páginas |
| `topo-headline` | CTA da primeira tela |
| `sequencia-night` | CTA no fim da sequência da Night Edition |
| `vitrine` | Vitrine com setas |
| `dossie` | Destaque da Night Edition |
| `formulario` | Formulário da home |
| `detalhe-versao` | Botão principal da página da versão |
| `barra-celular` | Barra fixa no celular, na página da versão |
| `formulario-versao` | Formulário da página da versão |
| `relacionados` | Cards de "Veja também" na página da versão |
| `rodape` | Rodapé |
| `pagina-404` | Página de versão inexistente |

Cada clique também é registrado em `window.dataLayer` como `{ event: "whatsapp_click", placement, vehicle, page }`. Para medir isso no Google Analytics 4, basta instalar o Google Tag Manager e criar um acionador para o evento `whatsapp_click`.

## Preços (regra do projeto)

Nenhum preço, desconto, taxa, parcela ou campanha é inventado. Cada versão tem um campo `price` em `data/catalog.json`:

| `price.mode` | O que aparece |
|---|---|
| `consulte` (atual) | "Consulte condições" |
| `demonstrativo` | O valor, com "Preço demonstrativo — sujeito a atualização" |
| `verificado` | O valor, com "Preço público sugerido" e a fonte (`source`) e data (`checkedAt`) |

Ofertas reais com regras completas entram em `offers[]`. Quando existirem, a seção de regras, as abas por perfil, os selos e os filtros de preço e de condição aparecem sozinhos.

O simulador funciona sem preço publicado: o visitante digita o valor informado pelo consultor e a taxa da instituição financeira.

## Imagens, vídeos e cores

```
img/originais/    Arquivos recebidos, intactos
img/veiculos/     Fotos em WebP (800 px e tamanho cheio) com srcset
img/video/        Loops MP4 sem áudio (vão e voltam, sem corte) + capa .webp
img/fundos/       Fundo abstrato
frames/           192 frames da sequência principal + manifest.json
```

**Quem usa cada foto:**

| Versão | Cores | Fotos |
|---|---|---|
| Rampage Rebel | Preto | Estúdio |
| Rampage R/T | Vermelho | Estúdio |
| Dakota Warlock | Branco | Estúdio |
| RAM 1500 Laramie | Cinza | Estúdio |
| RAM 2500 Laramie Night Edition | Preto | Estúdio, frontal noturno, grade (com vídeo), interior (com vídeo) |
| RAM 3500 Laramie Night Edition | Preto | Estúdio, frontal noturno, grade (com vídeo), traseira, interior (com vídeo) |
| RAM 3500 Laramie | Branco, Vermelho | Estúdio de cada cor, interior (com vídeo) |

**Regra de publicação:** versão sem nenhuma foto não aparece no site (vitrine, catálogo, formulário, simulador, sitemap). Hoje ficam guardadas, sem aparecer, a Rampage Laramie, a Dakota Laramie, a RAM 1500 Rebel, a RAM 2500 Laramie e a RAM 3500 Limited Longhorn. Basta adicionar uma foto em `colors[]` ou `images[]` para a versão voltar sozinha. Para forçar ou esconder uma versão, use `"published": true` ou `"published": false`.

**Selos:** fotos levam o selo "Imagem ilustrativa"; vídeos não levam selo.

**Como as cores funcionam:**
- A troca de cor usa as fotos de estúdio, que estão alinhadas entre si: a branca é idêntica à preta, e a vermelha difere 0,5%.
- Os vídeos de estúdio têm movimentos diferentes em cada cor. Por isso, só tocam quando o visitante clica em "Ver em movimento", e nunca no meio de uma troca.

**Para adicionar uma cor:**
1. Crie uma entrada em `vehicles[].colors[]` com `id`, `name`, `hex`, `images` e (opcional) `video`.
2. Mantenha nas fotos o mesmo ângulo, enquadramento e fundo das outras cores da versão.

**Para gerar as versões leves de uma foto nova:**

```bash
ffmpeg -i original.jpg -vf scale=1600:-2 -c:v libwebp -quality 82 img/veiculos/nome-1600.webp
ffmpeg -i original.jpg -vf scale=800:-2  -c:v libwebp -quality 82 img/veiculos/nome-800.webp
```

**Para trocar o vídeo da sequência:**

```bash
python tools/extrair_frames.py caminho/do/video.mp4
```

Os vídeos atuais estão em 848×478 (limite da versão gratuita do Flow). Em 1080p, a sequência e a grade ficam mais nítidas em monitores grandes: basta rodar o script de novo com o vídeo maior e reconverter o loop.

## Estrutura do código

```
index.html            Home
veiculo.html          Página de cada versão (?v=<id>), com 404 para id inexistente
privacidade.html      Modelo de aviso de privacidade
termos.html           Modelo de termos de uso
404.html              Página não encontrada
data/catalog.json     ÚNICA fonte de dados
css/style.css         Todo o visual (tokens no topo)
js/core.js            Tipos (JSDoc), catálogo, formatação, WhatsApp + origem, rastreamento, vídeos
js/cards.js           Card, bloco de preço, bolinhas de cor, troca de imagem com esmaecimento
js/showroom.js        Vitrine com setas, deslizar, teclado, cores e vídeo
js/catalog.js         Filtros combinados, contagens, ordenação, paginação, filtros na URL
js/simulator.js       Tabela Price, com ou sem preço publicado
js/lead-form.js       Formulário: máscaras, CPF/CNPJ, perfil, cor, envio
js/dealers.js         Busca por CEP (ViaCEP), cidade ou UF; geolocalização com permissão
js/film.js            Sequência guiada pelo scroll (canvas + GSAP + Lenis)
js/home.js            Montagem da home
js/vehicle.js         Página da versão: galeria por cor, metadados, barra fixa no celular
tools/extrair_frames.py   Vídeo → frames + manifest
tools/gerar_sitemap.py    catalog.json → sitemap.xml
tools/servir.py           Servidor local
```

## Testado

Testado no Edge com Playwright: desktop 1440×900, celular 390×844 com toque e modo de movimento reduzido. Nenhum erro de console. O que foi verificado:

- **Vitrine:** setas laterais, miniaturas, troca de cor (foto e mensagem do WhatsApp) e "Ver em movimento" tocando o vídeo da cor.
- **Catálogo:** troca de cor no card, filtros e contagens.
- **Simulador:** pede o valor quando a versão não tem preço publicado.
- **Formulário:** perfil vindo da seção de perfis, cor vinda da página da versão, origem correta em cada mensagem.
- **Página da versão:** galeria por cor e vídeo do interior.
- **WhatsApp:** número, texto do portfólio nos botões gerais, origem de cada botão e evento no `dataLayer`.
- **Celular e acessibilidade:** sem rolagem horizontal no celular. Com movimento reduzido, nenhum vídeo de produto toca e a sequência vira estática.

## O que ainda depende de você

| Item | Situação |
|---|---|
| Preços reais | Todas as versões em "Consulte condições". Para publicar, preencha `price` ou `offers[]`. |
| Fotos das versões ocultas | Rampage Laramie, Dakota Laramie, RAM 1500 Rebel, RAM 2500 Laramie e RAM 3500 Limited Longhorn voltam ao site quando tiverem foto. |
| Dados da operação | Razão social, CNPJ, endereço e horário não estão cadastrados. As linhas ficam escondidas e aparecem sozinhas quando você preencher `operation`. |
| Unidades | Quatro unidades fictícias (`dealers[]`). |
| Registro de leads em servidor | Sem backend, o pedido segue pelo WhatsApp. Para gravar, configure `leads.endpoint`. |
| Domínio | Trocar `exemplo.com.br` em `operation.siteUrl`, nas tags canonical e no `robots.txt`; depois rodar `python tools/gerar_sitemap.py`. |
| Painel administrativo | Não implementado: precisa de backend com login. |
| Textos legais | `privacidade.html` e `termos.html` são modelos para revisão. |
