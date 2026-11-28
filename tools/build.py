from pathlib import Path
from urllib.parse import urlparse
from html import escape as e
import json

root = Path(__file__).resolve().parent
seed = json.loads((root / 'tools.json').read_text())
expected = {'adobe-firefly', 'hermes-agent', 'higgsfield', 'runway', 'canva', 'photoroom'}
assert len(seed) == len(expected) and {t['slug'] for t in seed} == expected
levels = {
    'beginner': ('Beginner-friendly', 'Start with a template or one upload.'),
    'intermediate': ('Intermediate', 'Expect to adjust settings and iterate.'),
    'advanced': ('Advanced', 'Expect setup, integrations or permissions.'),
}
for t in seed:
    for key in ('name','what','pricing','priceShort','reviews','ratingShort','category','example','exampleType','edge','skip','checked','status','levelNote','firstTask'):
        assert isinstance(t[key], str) and t[key].strip(), (t['slug'], key)
    assert t['level'] in levels, t['slug']
    assert t['freeKind'] in {'recurring','limited','open','browse'}
    for url in [t['product'], t['pricingSource']['url'], t['exampleSource']['url'], *(s['url'] for s in [t.get('reviewSource'), t.get('extra',{}).get('source')] if s)]:
        p = urlparse(url)
        assert p.scheme == 'https' and p.netloc, (t['slug'], url)
html = (root / 'directory.template.html').read_text()
for marker, mime in (('LOGO', 'png'), ('LIGHT_LOGO', 'png'), ('CANDLE', 'jpeg')):
    html = html.replace(f'data:image/{mime};base64,@@{marker}@@', f'@@{marker}@@')
assert html.count('@@SEED@@') == 1
payload = json.dumps(seed, ensure_ascii=False, indent=2).replace('<', '\\u003c')
logo = (root.parent / 'otb-logo-dark.png').read_bytes()
light_logo = (root.parent / 'otb-logo-160.png').read_bytes()
assert all(asset.startswith(b'\x89PNG\r\n\x1a\n') for asset in (logo, light_logo))
def link(source, label=None):
    return f'<a href="{e(source["url"])}">{e(label or source["label"])}</a>' if source else ''

def field(title, text, source=None):
    return f'<div><dt>{e(title)}</dt><dd>{e(text)} {link(source)}</dd></div>'

def meter(level):
    bars = ''.join('<i></i>' for _ in levels)
    return f'<span class="experience-meter {e(level)}" aria-hidden="true">{bars}</span>'

def level_filter(level, label, description):
    count = sum(t['level'] == level for t in seed)
    return f'<button type="button" data-level="{e(level)}" aria-pressed="false"><span class="level-title">{meter(level)} <strong>{e(label)}</strong><span class="level-count">{count}</span></span><span class="scale-note">{e(description)}</span></button>'

gallery_art = {
    'adobe-firefly': ('Build campaign assets', '<rect x="13" y="15" width="43" height="38" rx="3"/><path d="m16 47 11-11 8 7 11-12 10 9m7-28 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><circle cx="33" cy="27" r="3"/>'),
    'runway': ('Animate a still', '<rect x="10" y="18" width="58" height="37" rx="4"/><path d="M22 18v37m34-37v37M10 29h12M10 44h12m34-15h12M56 44h12m-34-16 13 8-13 8z"/>'),
    'higgsfield': ('Direct the camera', '<path d="M12 29V17h13m28 0h13v12m0 15v12H53m-28 0H12V44m15-7h24m-12-12v24"/><circle cx="39" cy="37" r="15"/><circle cx="39" cy="37" r="4"/>'),
    'canva': ('Lay out a promo', '<rect x="17" y="13" width="44" height="47" rx="3"/><path d="M28 24h21m-21 7h14m-14 19 7-8 6 5 5-4 5 7zM9 22v42h42"/>'),
    'photoroom': ('Clean up product photos', '<rect x="12" y="15" width="54" height="43" rx="3"/><path d="M34 24h10v7l6 6v12H28V37l6-6zM28 39h22M17 53l9-9m-9 1 9-9m22-9 9-9m-4 13 9-9m-9 32 9-9"/>'),
    'hermes-agent': ('Connect a workflow', '<rect x="29" y="28" width="20" height="17" rx="3"/><rect x="8" y="15" width="12" height="12" rx="2"/><rect x="58" y="15" width="12" height="12" rx="2"/><rect x="33" y="56" width="12" height="12" rx="2"/><path d="M14 27v9h15m20 0h15v-9M39 45v11"/>'),
}
assert gallery_art.keys() == expected

def listing(t):
    slug, name = e(t['slug']), e(t['name'])
    extra = t.get('extra')
    supplementary = field(extra['label'], extra['text'], extra.get('source')) if extra else ''
    level = t['level']
    caption, art = gallery_art[t['slug']]
    workflow = f'''<div class="workflow">
    <p class="lead">Worth it for: <span>{e(t['edge'])}</span></p>
    <p class="lead">Stick with your assistant when: <span>{e(t['skip'])}</span></p>
    <p class="first-task"><strong>Try first:</strong> {e(t['firstTask'])}</p>
    <dl>{field('Example · '+t['exampleType'], t['example'], t['exampleSource'])}</dl></div>'''
    return f'''<article id="{slug}" class="listing" data-experience="{e(level)}">
    <div class="gallery-art" aria-hidden="true"><svg viewBox="0 0 78 74" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{art}</svg><span>{e(caption)}</span></div>
    <div class="identity">
    <div class="eyebrow">{e(t['category'])}</div><h2><a href="#{slug}">{name}</a></h2>
    <div class="experience-badge">{meter(level)} <strong>{e(levels[level][0])}</strong></div>
    <p class="level-note">{e(t['levelNote'])}</p>
    <p class="meta">{link(t['pricingSource'], t['priceShort'])}</p>
    <p class="meta">{link(t.get('reviewSource'), t['ratingShort']) if t.get('reviewSource') else e(t['ratingShort'])}</p>
    {link({'url': t['product'], 'label': 'Visit '+t['name']+' ↗'})}</div>
    <div class="listing-body"><p class="what">{e(t['what'])}</p>
    <div class="workflow-slot">{workflow}</div>
    <details class="details"><summary><span class="list-label">Full pricing, review notes &amp; sources</span><span class="gallery-label">Workflow, pricing &amp; sources</span></summary><div class="gallery-slot"><p class="level-note">{e(t['levelNote'])}</p>{workflow}</div><dl>
    {field('Price / free access', t['pricing'], t['pricingSource'])}
    {field('External reviews', t['reviews'], t.get('reviewSource'))}{supplementary}</dl>
    <p class="sources">Research snapshot · {e(t['checked'])} · {e(t['status'])}</p></details></div></article>'''

assert html.count('@@LISTINGS@@') == 1
reference = (root / 'candle-campaign-reference.jpg').read_bytes()
assert reference.startswith(b'\xff\xd8')
firefly = next(t for t in seed if t['slug'] == 'adobe-firefly')
tokens = {
    'SEED': payload, 'LOGO': '../otb-logo-dark.png',
    'LIGHT_LOGO': '../otb-logo-160.png',
    'CANDLE': 'candle-campaign-reference.jpg',
    'CANDLE_SOURCE': link(firefly['exampleSource'], 'Original sponsored demo ↗'),
    'LEVEL_FILTERS': '\n'.join(level_filter(k, *v) for k, v in levels.items()),
    'JOBS': '\n'.join(f'<option>{e(job)}</option>' for job in sorted({t['category'] for t in seed})),
    'LISTINGS': '\n'.join(map(listing, seed)),
}
output = html
for key, value in tokens.items():
    marker = f'@@{key}@@'
    assert output.count(marker) == 1, key
    output = output.replace(marker, value)
assert output.count('@@DEFAULT_THEME@@') == output.count('@@THEME_BUTTON@@') == 1
(root / 'index.html').write_text(output.replace('@@DEFAULT_THEME@@', 'light').replace('@@THEME_BUTTON@@', 'Dark mode'), encoding='utf-8')
print(f'Built tools/index.html with {len(seed)} validated listings.')
