"""
Drape simulation — pieces.json -> ghost-mannequin drape render (PNG).

Builds each pattern piece as a triangulated cloth mesh placed per its 3D
hint, joins everything into one object, adds loose "sewing" edges between
matched seam points, pins the shoulder seam, runs Blender's cloth solver
(sewing springs pull the garment together as it falls), and renders a neutral
grey front view on white with the Workbench engine.

Usage: blender -b -noaudio -P scripts/drape/sim.py -- pieces.json out.png [frames]
"""
import bpy
import bmesh
import json
import math
import sys

argv = sys.argv[sys.argv.index("--") + 1 :]

# A pristine scene: the default cube/light/camera would photobomb the render.
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
DATA = json.load(open(argv[0]))
OUT_PNG = argv[1]
FRAMES = int(argv[2]) if len(argv) > 2 else 80

S = 0.001  # pattern mm -> metres
HEIGHT = max(y for p in DATA["pieces"] if p["placement"]["kind"] in ("plane",) for _, y in p["points"]) if any(
    p["placement"]["kind"] == "plane" for p in DATA["pieces"]
) else max(y for p in DATA["pieces"] for _, y in p["points"])
# Vertical anchor: pattern y + Y_OFF = body coordinate (0 = high point
# shoulder, 460 = waist on the standard form). Brian-family tops use 0;
# dresses and lower-body garments anchor their own y=0 elsewhere.
Y_OFF = float(DATA.get("yOffset", 0.0))
BODY_KIND = DATA.get("bodyKind", "upper")

# Invisible ghost-mannequin body the cloth drapes over. Without it the sewing
# springs simply crush the garment flat. The base profile follows the studio
# measurement set (chest 1080mm, shoulders 445mm, biceps 335mm); per-draft
# body hints from extract.mjs scale it to the client's measurements.
_body = DATA.get("body", {})
_chest_s = float(_body.get("chest", 1.0))
_biceps_s = float(_body.get("biceps", 1.0))
_shoulder_s = float(_body.get("shoulder", 1.0))
_torso_s = float(_body.get("torso", 1.0))

ARM_R = 55.0 * _biceps_s  # arm stub radius — fills the sleeve tube so it can't ruffle
SHOULDER_X = 215.0 * _shoulder_s  # arm axis origin distance from centre (mm)
SHOULDER_PY = 40.0  # pattern-y of the shoulder joint

def z_of_body(by):
    """World z (metres) for a BODY-coordinate height (0 = HPS, 460 = waist)."""
    return (HEIGHT + Y_OFF - by) * S


# Body profile: (BODY-y, half-width a, half-depth b), down to JUST below the
# garment hem — the form must not continue far past the cloth, or the image
# model can't tell where the garment ends. The hem breakpoint follows THIS
# draft's actual hem so the crop stays right for longer/shorter blocks.
_HEM_BY = HEIGHT + Y_OFF + 26
if BODY_KIND == "upper":
    TORSO = [
        (by * _torso_s, a * _chest_s, b * _chest_s)
        for by, a, b in [(20, 55, 55), (38, 115, 85), (55, 185, 110), (240, 192, 128), (460, 175, 118)]
    ] + [(_HEM_BY, 182 * _chest_s, 123 * _chest_s)]
else:
    # Lower body (trousers, skirts): a hip form from just above the waist.
    # "lowerColumn" continues as a dress-form column to the hem; "lower"
    # (trousers) ends at the crotch, where the leg stubs take over.
    _hip_s = _chest_s  # hips scale with the same girth hint family
    _LOWER = [(400, 138, 110), (460, 135, 108), (575, 165, 135), (690, 172, 140)]
    if BODY_KIND == "lowerColumn":
        TORSO = [(by, a * _hip_s, b * _hip_s) for by, a, b in _LOWER] + [
            (_HEM_BY, 166 * _hip_s, 136 * _hip_s)
        ]
    else:
        TORSO = [(by, a * _hip_s, b * _hip_s) for by, a, b in _LOWER] + [(742, 168 * _hip_s, 138 * _hip_s)]

# Arm stubs end just below the sleeve hem for the same reason. Long sleeves
# hang closer to the body (a wide splay looks scarecrow-ish and crops out of
# frame); short sleeves keep the wider, airier tank/tee stance. For raglan
# sleeves, arm distance u runs from the shoulder joint with the biceps line
# landing at the body's armhole depth — the raglan zone above the biceps is
# shoulder, not arm length.
_sleeve_pl = next((p["placement"] for p in DATA["pieces"] if p["placement"]["kind"] == "sleeve"), None)
_RAGLAN = bool(_sleeve_pl and _sleeve_pl.get("raglan"))
if _RAGLAN:
    ARM_TILT = math.radians(30 if _sleeve_pl["y1"] <= 300 else 16)
    RAGLAN_U0 = max(0.0, _sleeve_pl.get("armDepth", 250.0) - SHOULDER_PY) / math.cos(ARM_TILT)
    ARM_LEN = _sleeve_pl["y1"] + RAGLAN_U0 + 45.0
else:
    _sleeve_umax = max(
        (max(y for _, y in p["points"]) - min(y for _, y in p["points"])
         for p in DATA["pieces"] if p["placement"]["kind"] == "sleeve"),
        default=335.0,
    )
    ARM_TILT = math.radians(30 if _sleeve_umax <= 350 else 16)
    RAGLAN_U0 = 0.0
    ARM_LEN = _sleeve_umax + 45.0
WRIST_R = ARM_R * 0.6  # arm stubs taper toward the wrist


def torso_ab(y):
    """Form half-width/half-depth at PATTERN y (converted to body coords)."""
    by = y + Y_OFF
    if by <= TORSO[0][0]:
        return TORSO[0][1], TORSO[0][2]
    for (y0, a0, b0), (y1, a1, b1) in zip(TORSO, TORSO[1:]):
        if by <= y1:
            t = (by - y0) / (y1 - y0)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
    return TORSO[-1][1], TORSO[-1][2]


def top_edge_y(piece, x):
    """Pattern-y of the piece's top edge at this x, from the emitted profile
    (linear interpolation between bins)."""
    prof = piece.get("topProfile")
    if not prof:
        return 10.0 + 22.0 * min(1.0, max(0.0, (abs(x) - 125.0) / 98.0))
    if x <= prof[0][0]:
        return prof[0][1]
    for (x0, y0), (x1, y1) in zip(prof, prof[1:]):
        if x <= x1:
            t = (x - x0) / max(1e-6, x1 - x0)
            return y0 + (y1 - y0) * t
    return prof[-1][1]


_neck_w_cache = {}


def neck_half_width(piece):
    """|x| extent of the neckline segments — inside it, the top edge is the
    collar and the panel stays on the wrapped surface."""
    name = piece["name"]
    if name not in _neck_w_cache:
        w = 100.0
        segs = piece.get("segments", {})
        pts = piece["points"]
        xs = []
        n = len(pts)
        for seg_name, (start, end) in segs.items():
            if not seg_name.startswith("neck"):
                continue
            i = start
            while True:
                xs.append(abs(pts[i % n][0]))
                if i % n == end % n:
                    break
                i += 1
        if xs:
            w = max(xs)
        _neck_w_cache[name] = w
    return _neck_w_cache[name]


_width_cache = {}


def width_at(piece, y):
    """Max |x| of the piece at pattern y, from the emitted width profile."""
    prof = piece.get("widthProfile")
    if not prof:
        return None
    if y <= prof[0][0]:
        return prof[0][1]
    for (y0, w0), (y1, w1) in zip(prof, prof[1:]):
        if y <= y1:
            t = (y - y0) / max(1e-6, y1 - y0)
            return w0 + (w1 - w0) * t
    return prof[-1][1]


def clamp_out(wx, wy, y_level):
    """Push a cloth point (mm, at torso level y_level) radially out of the
    body ellipse so nothing starts inside the collision mesh."""
    ta, tb = torso_ab(y_level)
    a2, b2 = ta + 12.0, tb + 12.0
    k = (wx / a2) ** 2 + (wy / b2) ** 2
    if 1e-9 < k < 1.0:
        f = 1.0 / math.sqrt(k)
        return wx * f, wy * f
    return wx, wy


def arm_frame(direction):
    """Origin (mm) + orthonormal axes of the tilted hanging arm."""
    origin = (SHOULDER_X * direction, 0.0, HEIGHT + Y_OFF - SHOULDER_PY)
    axis = (math.sin(ARM_TILT) * direction, 0.0, -math.cos(ARM_TILT))  # down the arm
    e1 = (math.cos(ARM_TILT) * direction, 0.0, math.sin(ARM_TILT))  # outward
    e2 = (0.0, 1.0, 0.0)
    return origin, axis, e1, e2

sleeve_half = {
    p["name"]: max(abs(x) for x, _ in p["points"])
    for p in DATA["pieces"]
    if p["placement"]["kind"] == "sleeve"
}
sleeve_miny = {
    p["name"]: min(y for _, y in p["points"])
    for p in DATA["pieces"]
    if p["placement"]["kind"] == "sleeve"
}


# Elliptical shell just outside the torso that the front/back pieces are
# pre-wrapped onto — the sim then only stitches seams and relaxes, instead of
# assembling flat planes from far away (which crumples chaotically). The shell
# is scaled so a quarter arc fits the widest piece half + a seam gap: if the
# pieces wrapped PAST the side line they would cross each other and the
# self-collision solver explodes.
def _make_arc_table(A, B):
    phis, ss = [0.0], [0.0]
    while phis[-1] < math.pi / 2:
        p0, p1 = phis[-1], phis[-1] + 0.002
        x0, y0 = A * math.sin(p0), B * math.cos(p0)
        x1, y1 = A * math.sin(p1), B * math.cos(p1)
        phis.append(p1)
        ss.append(ss[-1] + math.hypot(x1 - x0, y1 - y0))
    return phis, ss


_max_half = max(
    (abs(x) for p in DATA["pieces"] if p["placement"]["kind"] == "plane" for x, _ in p["points"]),
    default=250.0,
)
_phis, _ss = _make_arc_table(207.0, 143.0)
_scale = (_max_half + 10.0) / _ss[-1]  # quarter arc = widest half + seam gap
SHELL_A, SHELL_B = 207.0 * _scale, 143.0 * _scale
_phis, _ss = _make_arc_table(SHELL_A, SHELL_B)


def _phi_at(s):
    lo, hi = 0, len(_ss) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if _ss[mid] < s:
            lo = mid + 1
        else:
            hi = mid
    return _phis[lo]


def place(piece, x, y):
    """Pattern-space (x, y) -> world metres per the piece's placement hint."""
    pl = piece["placement"]
    if pl["kind"] == "plane":
        # Wrap pattern x around the shell by arc length. Front centre sits at
        # (0, -B), back centre at (0, +B); both walk toward the sides so the
        # side seams nearly meet. side = -1 for front, +1 for back.
        side = -1.0 if pl["y"] < 0 else 1.0
        # Per-height wrap scale: a flared garment wraps snug where it is
        # narrow and full where it is wide; one global scale bunches the
        # excess wherever the garment is narrower than its widest line.
        w_here = width_at(piece, y)
        f = max(0.35, (w_here + 10.0) / _ss[-1]) if w_here else 1.0
        phi = _phi_at(abs(x) / f)
        wx = math.copysign(f * SHELL_A * math.sin(phi), x)
        # Depth follows the torso's own vertical profile (+ease) so the cloth
        # starts just OUTSIDE the body at every height. Above the armpit only
        # the neck stub exists, so the shoulder region collapses to the seam
        # line (near 0 depth) where the pins hold front and back together.
        _, tb = torso_ab(y)
        # `outset` layers overlapping panels (a shirt's button stand) so the
        # closed placket stacks instead of interpenetrating.
        wrapped = side * (tb + 15.0 + float(pl.get("outset", 0.0))) * math.cos(phi)
        # The panel hangs from its own top edge (shoulder seam, tank strap or
        # raglan diagonal — extract emits the profile): at the top edge it
        # sits near centre depth, sweeping onto the wrapped chest as it
        # descends. Near the centre the top edge IS the neckline: fully
        # wrapped so the collar lies on the body, not pinched to the axis.
        y_top = top_edge_y(piece, x)
        neck_w = neck_half_width(piece)
        t_seam = min(1.0, max(0.08, (y - y_top) / 120.0))
        t = max(t_seam, min(1.0, max(0.0, (neck_w - abs(x)) / 10.0)))
        wy = side * 8.0 * (1 - t) + wrapped * t
        wx, wy = clamp_out(wx, wy, y)
        return (wx * S, wy * S, (HEIGHT - y) * S)
    if pl["kind"] == "leg":
        # Trouser panel: half-tube around a leg stub, sweeping onto the hip
        # shell above the fork (the same tube+joint-sweep idea as sleeves).
        prof = piece["edgesProfile"]
        lo, hi = prof[0][1], prof[0][2]
        for (y0, l0, h0), (y1, l1, h1) in zip(prof, prof[1:]):
            if y <= y1:
                t = (y - y0) / max(1e-6, y1 - y0)
                lo, hi = l0 + (l1 - l0) * t, h0 + (h1 - h0) * t
                break
        else:
            lo, hi = prof[-1][1], prof[-1][2]
        w = max(1.0, hi - lo)
        r = w / math.pi + 2.0
        leg = pl["leg"]
        # s: 0 at the OUTSEAM edge, 1 at the INSEAM edge (mirrored panels
        # walk their profile the other way).
        s_n = (x - lo) / w if leg > 0 else (hi - x) / w
        s_n = min(1.0, max(0.0, s_n))
        gap = 4.0 / r
        if pl["panel"] == "front":
            phi = (math.pi / 2 - gap) - s_n * (math.pi - 2 * gap)
            lx = 92.0 * _chest_s + r * math.sin(phi)
            ly = -r * math.cos(phi)
        else:
            phi = (-math.pi / 2 + gap) + s_n * (math.pi - 2 * gap)
            lx = 92.0 * _chest_s + r * math.sin(phi)
            ly = r * math.cos(phi)
        fork_y = float(piece.get("forkY", 280.0))
        if y < fork_y:
            # Above the fork: sweep onto the hip shell — outseam edge stays
            # at the hip side, inseam/crotch edge reaches CF/CB.
            ta, tb = torso_ab(y)
            A, B = ta + 12.0, tb + 12.0
            psi = (1.0 - s_n) * (math.pi / 2)
            hx = A * math.sin(psi)
            hy = -B * math.cos(psi) if pl["panel"] == "front" else B * math.cos(psi)
            min_y = min(py for _, py in piece["points"])
            t = min(1.0, max(0.0, (fork_y - y) / max(1.0, fork_y - min_y)))
            lx = lx * (1 - t) + hx * t
            ly = ly * (1 - t) + hy * t
        return (leg * lx * S, ly * S, (HEIGHT - y) * S)

    # Sleeve: wrap into a CONE around the tilted arm axis — radius follows the
    # piece's local width (biceps -> hem taper), else a straight tube leaves
    # an open wedge along a tapered forearm. Underarm edges meet inner-side.
    if y <= 0:
        w = pl["w0"]  # cap region keeps the biceps width
    else:
        t = min(1.0, y / max(1.0, pl["y1"]))
        w = pl["w0"] + (pl["w1"] - pl["w0"]) * t
    r = w / math.pi + 1  # ~exact wrap; slack only invites ruffling
    # Slightly less than a full wrap: the underarm edges must NOT start
    # coincident (self-collision fights zero-length sewing and explodes).
    theta = max(-math.pi, min(math.pi, (x / w) * (math.pi - 6.0 / r)))
    # u: distance down the arm axis from the shoulder joint.
    if pl.get("raglan"):
        u = y + RAGLAN_U0  # biceps line lands at the armhole depth
    else:
        u = y - sleeve_miny[piece["name"]]  # 0 at cap top
    o, ax, e1, e2 = arm_frame(pl["dir"])
    c, s_ = r * math.cos(theta), r * math.sin(theta)
    wx = o[0] + u * ax[0] + c * e1[0]
    wy = c * e1[1] + s_ * e2[1]
    wz = o[2] + u * ax[2] + c * e1[2]
    if pl.get("raglan") and y < -60.0:
        # Raglan: the zone ABOVE the shoulder ball sweeps off the arm toward
        # the neck — at the top (the sleeve's own neckline arc) it sits
        # beside the neck stub. The deltoid zone (y in [-60, 0]) stays on the
        # arm tube: sweeping it too gathers excess cloth into shoulder puffs.
        span = max(1.0, -sleeve_miny[piece["name"]] - 60.0)
        t = min(1.0, (-y - 60.0) / span)
        tx = pl["dir"] * pl.get("neckX", 95.0)
        wx = wx * (1 - t) + tx * t
        wy = wy * (1 - t) + (s_ * 0.5) * t
        wz = wz * (1 - t) + (HEIGHT - 10.0) * t
    wx, wy = clamp_out(wx, wy, HEIGHT - wz)
    return (wx * S, wy * S, wz * S)


# ---- Build per-piece triangulated meshes, tracking boundary vertex order ----
all_verts = []
all_faces = []
offsets = {}
boundary_index = {}  # piece -> list of global indices for its ORIGINAL boundary points

for piece in DATA["pieces"]:
    # Build the piece FLAT in pattern space (mm), so triangulation and
    # subdivision work in 2D, then map every vertex — interior included —
    # through place(). (Placing only the boundary first would leave interior
    # verts as straight 3D chords cutting through the wrapped shapes.)
    bm = bmesh.new()
    boundary2d = piece["points"]
    boundary = [bm.verts.new((x, y, 0.0)) for x, y in boundary2d]
    bm.verts.ensure_lookup_table()
    edges = []
    n = len(boundary)
    for i in range(n):
        edges.append(bm.edges.new((boundary[i], boundary[(i + 1) % n])))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
    # Densify for a credible drape: two rounds of subdivision + retriangulate.
    for _ in range(2):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.beautify_fill(bm, faces=list(bm.faces), edges=list(bm.edges))
    bm.verts.ensure_lookup_table()
    off = len(all_verts)
    offsets[piece["name"]] = off
    # Mesh ops may invalidate python vert refs — recover the boundary verts by
    # 2D coordinate (their positions are untouched by fill/subdivide).
    by_co = {}
    for v in bm.verts:
        by_co[(round(v.co.x, 3), round(v.co.y, 3))] = v.index
    def find(x, y):
        key = (round(x, 3), round(y, 3))
        if key in by_co:
            return by_co[key]
        best, best_d = 0, 1e9
        for v in bm.verts:
            d = (v.co.x - x) ** 2 + (v.co.y - y) ** 2
            if d < best_d:
                best, best_d = v.index, d
        return best
    boundary_index[piece["name"]] = [off + find(x, y) for x, y in boundary2d]
    for v in bm.verts:
        all_verts.append(place(piece, v.co.x, v.co.y))
    for f in bm.faces:
        all_faces.append(tuple(off + v.index for v in f.verts))
    bm.free()

# ---- Sewing edges from matched seam points -----------------------------------
def seg_indices(piece_name, seg_name):
    piece = next(p for p in DATA["pieces"] if p["name"] == piece_name)
    start, end = piece["segments"][seg_name]
    npts = len(piece["points"])
    idxs = []
    i = start
    while True:
        idxs.append(boundary_index[piece_name][i % npts])
        if i % npts == end % npts:
            break
        i += 1
    return idxs


def match(a, b):
    """Pair two index lists point-by-point, resampling the longer by skipping."""
    if len(a) > len(b):
        a2, b2 = match(b, a)
        return b2, a2
    picks = [b[round(i * (len(b) - 1) / max(1, len(a) - 1))] for i in range(len(a))]
    return a, picks


sew_edges = []
pin_indices = set()
for seam in DATA["seams"]:
    ia = seg_indices(*seam["a"])
    ib = seg_indices(*seam["b"])
    # Auto-orient: flip b if that brings matched endpoints closer in world
    # space (rest positions) — more reliable than hand-set direction flags.
    straight = math.dist(all_verts[ia[0]], all_verts[ib[0]]) + math.dist(all_verts[ia[-1]], all_verts[ib[-1]])
    flipped = math.dist(all_verts[ia[0]], all_verts[ib[-1]]) + math.dist(all_verts[ia[-1]], all_verts[ib[0]])
    if flipped < straight:
        ib = list(reversed(ib))
    ia, ib = match(ia, ib)
    for va, vb in zip(ia, ib):
        if va != vb:
            sew_edges.append((va, vb))
    if seam.get("pin"):
        pin_indices.update(ia)
        pin_indices.update(ib)

# Pin the necklines too: on a ghost mannequin the collar keeps its shape (a
# real neckband would hold it); unpinned it sags open into the neck hole.
# Pin the sleeve-cap edges as well — they sit exactly where the armscye lies
# on the body, and act as rigid anchors the body panels get stitched to.
# Without this, the armscye springs ratchet the whole sleeve up the arm and
# it bunches at the shoulder. Pieces can also request extra pinned segments
# (e.g. ribbed cuffs gripping the wrist).
for piece in DATA["pieces"]:
    extra = set(piece.get("pinSegments", []))
    stride = max(1, int(piece.get("pinStride", 1)))
    for seg_name in piece.get("segments", {}):
        if seg_name.startswith("neck") or seg_name.startswith("cap"):
            pin_indices.update(seg_indices(piece["name"], seg_name))
        elif seg_name in extra:
            idxs = seg_indices(piece["name"], seg_name)
            pin_indices.update(idxs[::stride])
            pin_indices.add(idxs[-1])

# ---- Invisible collision body (ghost mannequin) -------------------------------
def build_body():
    verts, faces = [], []
    N = 24

    def ring(cx, a, b, z):
        start = len(verts)
        for i in range(N):
            t = 2 * math.pi * i / N
            verts.append(((cx + a * math.cos(t)) * S, b * math.sin(t) * S, z))
        return start

    def bridge(r0, r1):
        for i in range(N):
            j = (i + 1) % N
            faces.append((r0 + i, r0 + j, r1 + j, r1 + i))

    def cap(r0, cz, cx=0.0):
        c = len(verts)
        verts.append((cx * S, 0.0, cz))
        for i in range(N):
            faces.append((r0 + i, r0 + (i + 1) % N, c))

    rings = [ring(0, a, b, z_of_body(by)) for by, a, b in TORSO]
    for r0, r1 in zip(rings, rings[1:]):
        bridge(r0, r1)
    cap(rings[0], z_of_body(TORSO[0][0] - 10))

    if BODY_KIND == "lower":
        # Leg stubs: tapered cones from the crotch to just past the hem.
        LEG_X = 92.0 * _chest_s
        R_THIGH = 95.0 * _chest_s
        R_ANKLE = 42.0 * _chest_s
        for d in (1, -1):
            top = ring(LEG_X * d, R_THIGH, R_THIGH, z_of_body(700))
            bot = ring(LEG_X * d, R_ANKLE, R_ANKLE, z_of_body(_HEM_BY + 6))
            bridge(top, bot)
            c = len(verts)
            verts.append((LEG_X * d * S, 0.0, z_of_body(690)))
            for i in range(N):
                faces.append((top + i, top + (i + 1) % N, c))

    # Arm stubs: tapered cones hanging from the shoulder joints, tilted
    # outward — matching the sleeves' own biceps->wrist taper.
    def arm_ring(o, ax, e1, e2, u, r):
        start = len(verts)
        for i in range(N):
            t = 2 * math.pi * i / N
            c, s_ = r * math.cos(t), r * math.sin(t)
            verts.append((
                (o[0] + u * ax[0] + c * e1[0]) * S,
                (s_ * e2[1]) * S,
                (o[2] + u * ax[2] + c * e1[2]) * S,
            ))
        return start

    for d in (1, -1) if BODY_KIND == "upper" else ():
        o, ax, e1, e2 = arm_frame(d)
        top = arm_ring(o, ax, e1, e2, 10, ARM_R)
        bot = arm_ring(o, ax, e1, e2, ARM_LEN, WRIST_R)
        bridge(top, bot)
        c = len(verts)
        verts.append((o[0] * S, 0.0, (o[2] + 10) * S))
        for i in range(N):
            faces.append((top + i, top + (i + 1) % N, c))

    m = bpy.data.meshes.new("body")
    m.from_pydata(verts, [], faces)
    m.update()
    # Hand-wound quads have inconsistent normals; collision response follows
    # face normals, so recalc them all to point outside.
    bmb = bmesh.new()
    bmb.from_mesh(m)
    bmesh.ops.recalc_face_normals(bmb, faces=bmb.faces)
    bmb.to_mesh(m)
    bmb.free()
    m.update()
    o = bpy.data.objects.new("body", m)
    bpy.context.collection.objects.link(o)
    col = o.modifiers.new("collision", "COLLISION")
    col.settings.thickness_outer = 0.003
    col.settings.thickness_inner = 0.002
    # The body stays in the render as a darker matte dress form: it gives the
    # reference anatomical context and hides the armscye seam gaps.
    for poly in m.polygons:
        poly.use_smooth = True
    # Dark charcoal: maximum contrast against the pale cloth so the image
    # model can't confuse mannequin for garment.
    mat_b = bpy.data.materials.new("body_grey")
    mat_b.use_nodes = True
    nb = mat_b.node_tree.nodes["Principled BSDF"]
    nb.inputs["Base Color"].default_value = (0.13, 0.13, 0.14, 1.0)
    nb.inputs["Roughness"].default_value = 0.85
    m.materials.append(mat_b)
    return o


build_body()

# ---- Assemble the object ------------------------------------------------------
mesh = bpy.data.meshes.new("garment")
mesh.from_pydata(all_verts, sew_edges, all_faces)
mesh.update()
for poly in mesh.polygons:
    poly.use_smooth = True
obj = bpy.data.objects.new("garment", mesh)
bpy.context.collection.objects.link(obj)

vg = obj.vertex_groups.new(name="pin")
vg.add(list(pin_indices), 1.0, "REPLACE")

mod = obj.modifiers.new("cloth", "CLOTH")
st = mod.settings
st.quality = 10
st.mass = 0.3
st.air_damping = 2.0
st.tension_stiffness = 40
st.compression_stiffness = 40
st.shear_stiffness = 20
st.bending_stiffness = 1.0
st.vertex_group_mass = "pin"
for name in ("use_sewing_springs", "use_sewing"):
    if hasattr(st, name):
        setattr(st, name, True)
if hasattr(st, "sewing_force_max"):
    # The garment starts nearly assembled — gentle stitching only. Strong
    # sewing forces whip the light cloth into permanent crumples. Darted
    # blocks ask for more via the sim hint (darts fight the side seams).
    st.sewing_force_max = float(DATA.get("sim", {}).get("sewForce", 2))
try:
    mod.collision_settings.distance_min = 0.003
    mod.collision_settings.collision_quality = 4
    mod.collision_settings.use_self_collision = True
    mod.collision_settings.self_distance_min = 0.002
except Exception:
    pass

# Soften the harsh micro-folds the coarse sim leaves (esp. around the yoke) —
# the reference should read as smooth jersey, not crinkled paper. Boundary
# verts are excluded: smoothing them scallops the hems and necklines into a
# false "lettuce edge" that the image model faithfully copies.
# Uniform smoothing, boundary included — excluding the boundary pins the edge
# verts while the interior contracts, which cuts sawtooth teeth into every hem.
sm = obj.modifiers.new("smooth", "SMOOTH")
sm.factor = 0.4
sm.iterations = 2

# ---- Simulate -----------------------------------------------------------------
scene = bpy.context.scene
if FRAMES > 0:
    scene.frame_start = 1
    scene.frame_end = FRAMES
    mod.point_cache.frame_end = FRAMES
    bpy.ops.ptcache.bake_all(bake=True)
    scene.frame_set(FRAMES)
else:
    obj.modifiers.remove(mod)

# ---- Render (Cycles CPU — no OpenGL needed on headless runners) ---------------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.use_denoising = False
scene.cycles.samples = 96
mat = bpy.data.materials.new("cloth_grey")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.84, 0.84, 0.84, 1.0)
bsdf.inputs["Roughness"].default_value = 0.9
obj.data.materials.append(mat)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
scene.world = world
# Raking key light from the upper front-left so folds read; soft shadows.
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.5
sun.data.angle = 0.3
sun.rotation_euler = (math.radians(60), 0, math.radians(-35))
bpy.context.collection.objects.link(sun)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 60
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
mid_z = (HEIGHT * S) * 0.5
import os as _os
if _os.environ.get("DRAPE_CAM") == "quarter":
    cam.location = (1.5, -1.5, mid_z + 0.15)
    cam.rotation_euler = (math.radians(83), 0, math.radians(45))
else:
    cam.location = (0, -2.0, mid_z)
    cam.rotation_euler = (math.pi / 2, 0, 0)
scene.camera = cam

scene.render.resolution_x = 1024
scene.render.resolution_y = 1280
scene.render.film_transparent = False
obj_eval = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
cos = [obj_eval.matrix_world @ v.co for v in obj_eval.data.vertices]
xs = sorted(c.x for c in cos); ys = sorted(c.y for c in cos); zs = sorted(c.z for c in cos)
print(f"bbox x[{xs[0]:.2f},{xs[-1]:.2f}] y[{ys[0]:.2f},{ys[-1]:.2f}] z[{zs[0]:.2f},{zs[-1]:.2f}]")
# Pull the camera back for wide garments (long splayed sleeves) so nothing
# crops out of frame.
if _os.environ.get("DRAPE_CAM") != "quarter":
    cam.location.y = -max(2.0, (xs[-1] - xs[0]) * 1.9)
extra = [int(f) for f in argv[3].split(",")] if len(argv) > 3 else []
for f in extra:
    scene.frame_set(f)
    scene.render.filepath = OUT_PNG.replace(".png", f"-f{f}.png")
    bpy.ops.render.render(write_still=True)
if FRAMES > 0:
    scene.frame_set(FRAMES)
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print(f"drape render written: {OUT_PNG} (verts {len(all_verts)}, sew edges {len(sew_edges)}, pins {len(pin_indices)})")
