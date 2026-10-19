"""Genera public/gyaru/leopard-rosa.svg: tile de leopardo repetible (rosetas rotas + manchas).
Uso: python scripts/generar-leopardo.py [semilla]"""
import math, random, sys

T = 360                                  # tamaño del tile en px
FONDO, CENTRO, MANCHA = '#fff3f9', '#fde2ef', '#f6bbd9'
rnd = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 7)


def ruido(n, amp):
    """Radio irregular suave: suma de senos con fase aleatoria."""
    ks = [(k, rnd.uniform(0, 6.28), amp / k) for k in (2, 3, 5)]
    return lambda a: 1 + sum(m * math.sin(k * a + f) for k, f, m in ks)


def suave(pts):
    """Polígono cerrado -> path con curvas cuadráticas por puntos medios."""
    mid = lambda p, q: ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    m0 = mid(pts[-1], pts[0])
    d = f'M{m0[0]:.0f} {m0[1]:.0f}'
    for i, p in enumerate(pts):
        m = mid(p, pts[(i + 1) % len(pts)])
        d += f'Q{p[0]:.0f} {p[1]:.0f} {m[0]:.0f} {m[1]:.0f}'
    return d + 'Z'


def mancha(cx, cy, r):
    f, n, e, rot = ruido(3, 0.3), 14, rnd.uniform(0.45, 0.9), rnd.uniform(0, 3.14)
    return suave([(cx + r * f(a) * (math.cos(a) * math.cos(rot) - e * math.sin(a) * math.sin(rot)),
                   cy + r * f(a) * (math.cos(a) * math.sin(rot) + e * math.sin(a) * math.cos(rot)))
                  for a in (i * 6.283 / n for i in range(n))])


def roseta(cx, cy, R):
    """Centro relleno + 2-4 arcos gruesos con puntas afiladas alrededor."""
    f = ruido(3, 0.2)
    rot, squash = rnd.uniform(0, 6.28), rnd.uniform(0.55, 0.85)
    pt = lambda a, r: (cx + r * math.cos(a) * math.cos(rot) - r * squash * math.sin(a) * math.sin(rot),
                       cy + r * math.cos(a) * math.sin(rot) + r * squash * math.sin(a) * math.cos(rot))
    fc = ruido(3, 0.25)
    centro = suave([pt(a, R * 0.92 * fc(a)) for a in (i * 6.283 / 14 for i in range(14))])
    arcos, a0, n = [], rnd.uniform(0, 6.28), rnd.choice((3, 3, 4, 4, 5))
    for i in range(n):
        span = 6.283 / n * rnd.uniform(0.45, 0.9)
        ini = a0 + i * 6.283 / n + rnd.uniform(-0.3, 0.3)
        grosor, g = R * rnd.uniform(0.3, 0.5), ruido(3, 0.35)
        # puntas romas (raíz del seno) y grosor que varía a lo largo del arco
        w = lambda j: grosor * 0.5 * math.sin(math.pi * j / 10) ** 0.6 * g(j * 0.7)
        angs = [ini + span * j / 10 for j in range(11)]
        ext = [pt(a, R * f(a) + w(j) * 1.2) for j, a in enumerate(angs)]
        inn = [pt(a, R * f(a) - w(j) * 0.8) for j, a in enumerate(angs)]
        arcos.append(suave(ext + inn[::-1]))
    return centro, arcos


# Puntos con distancia mínima en el toro, para que el tile empate sin costuras.
def dist(p, q):
    dx, dy = abs(p[0] - q[0]), abs(p[1] - q[1])
    return math.hypot(min(dx, T - dx), min(dy, T - dy))

rosetas = []
for _ in range(4000):
    p = (rnd.uniform(0, T), rnd.uniform(0, T), rnd.uniform(14, 26))
    if all(dist(p, q) > p[2] + q[2] + 3 for q in rosetas):
        rosetas.append(p)
manchas = []
for _ in range(4000):
    p = (rnd.uniform(0, T), rnd.uniform(0, T), rnd.uniform(3, 7))
    if all(dist(p, q) > p[2] + q[2] + 6 for q in rosetas + manchas):
        manchas.append(p)
    if len(manchas) == 30:
        break

# Cada forma se dibuja también en las copias vecinas que tocan el borde; misma semilla = misma forma.
centros, oscuros = [], []
for i, (x, y, r) in enumerate(rosetas + manchas):
    for dx in (-T, 0, T):
        for dy in (-T, 0, T):
            if -2 * r < x + dx < T + 2 * r and -2 * r < y + dy < T + 2 * r:
                rnd.seed(i)
                if i < len(rosetas):
                    c, a = roseta(x + dx, y + dy, r); centros.append(c); oscuros += a
                else:
                    oscuros.append(mancha(x + dx, y + dy, r))

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {T} {T}" width="{T}" height="{T}">'
       f'<rect width="{T}" height="{T}" fill="{FONDO}"/>'
       f'<path fill="{CENTRO}" d="{"".join(centros)}"/>'
       f'<path fill="{MANCHA}" d="{"".join(oscuros)}"/></svg>')
open('public/gyaru/leopard-rosa.svg', 'w').write(svg)
print(f'{len(rosetas)} rosetas, {len(manchas)} manchas, {len(svg) // 1024} KB')
