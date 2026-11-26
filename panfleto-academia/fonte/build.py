import re
s = open('tpl.html').read()

def q(f):
    t = open(f).read()
    w = re.search(r'width="(\d+)"', t).group(1)
    return t.replace(f'width="{w}" height="{w}"', f'viewBox="0 0 {w} {w}"').replace('<svg ', '<svg shape-rendering="crispEdges" ')

logo = ('<svg width="7.4mm" height="7.4mm" viewBox="0 0 64 64"><path d="M9 20 L22 46 L35 20" fill="none" stroke="#6410C9" '
        'stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 24 V42 M39 33 H57" fill="none" '
        'stroke="#E0A800" stroke-width="6.5" stroke-linecap="round"/></svg>')
s = s.replace('QRCAD', q('qr_cad.svg')).replace('QRPAR', q('qr_par.svg')).replace('>LOGO<', '>' + logo + '<')
open('panfleto.html', 'w').write(s)
