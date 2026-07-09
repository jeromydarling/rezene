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
import os as _os
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
# A circle skirt cones outward as it falls: its flat radial length maps to a
# SHORTER vertical drop (the rest goes sideways), so the effective garment
# height is the worn drop, not the flat length — the hem then lands at z≈0
# and the collision column is cropped just below it like every other block.
_circle_pl = next((p["placement"] for p in DATA["pieces"] if p["placement"]["kind"] == "circle"), None)
if _circle_pl:
    _circle_k = _circle_pl["thetaSpan"] / (2 * math.pi)
    HEIGHT = (_circle_pl["rOut"] - _circle_pl["rIn"]) * math.sqrt(max(0.0, 1.0 - _circle_k**2))
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
# Arm axis origin distance from centre (mm). Env override for pose experiments.
SHOULDER_X = float(_os.environ.get("DRAPE_SHOULDER_X", "215.0")) * _shoulder_s
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
_TILT_OVERRIDE = _os.environ.get("DRAPE_ARM_TILT")
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
if _TILT_OVERRIDE:
    ARM_TILT = math.radians(float(_TILT_OVERRIDE))
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
    if pl["kind"] == "circle":
        # Circle skirt: the flat piece is a ring sector whose inner arc IS the
        # waist. Worn, that arc wraps the full 2π of the body, so a flat
        # radius r lands on a circle of radius k*r (k = flat angle / 2π) and
        # the leftover radial length becomes vertical drop — a perfect cone
        # the solver then relaxes into folds.
        k = pl["thetaSpan"] / (2 * math.pi)
        r = pl["rIn"] + y
        frac = min(1.0, max(0.0, x / (pl["thetaSpan"] * pl["rMid"])))
        psi = frac * 2 * math.pi - math.pi  # seam edges meet at centre back
        R = k * r
        wx = R * math.sin(psi)
        wy = -R * math.cos(psi)
        drop = y * math.sqrt(max(0.0, 1.0 - k * k))
        return (wx * S, wy * S, (HEIGHT - drop) * S)
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
all_flat = []
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
        # Flat pattern coordinates are the cloth's TRUE rest state (the cut
        # pieces) — kept per vertex so the fit map can measure real strain.
        all_flat.append((v.co.x, v.co.y))
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
seam_sides = []  # oriented FULL-density sides per seam — the fit map's densified pairing
pin_indices = set()


def _pair_score(ia, ib):
    """Total rest-position distance over an arc-fraction pairing — the flip
    test must consider the WHOLE seam: endpoint distances alone mis-orient
    armscye seams (panel edge and sleeve cap endpoints sit nearly symmetric),
    which reversed the sewing around the ring — springs pulled tangentially
    against each other, the armscye never closed at any force, and the
    rotated sleeve tube looked normal so it was invisible for seven waves."""
    n = 24
    sa = [ia[round(i * (len(ia) - 1) / (n - 1))] for i in range(n)]
    sb = [ib[round(i * (len(ib) - 1) / (n - 1))] for i in range(n)]
    return sum(math.dist(all_verts[a], all_verts[b]) for a, b in zip(sa, sb))


for seam in DATA["seams"]:
    ia = seg_indices(*seam["a"])
    ib = seg_indices(*seam["b"])
    if _pair_score(ia, list(reversed(ib))) < _pair_score(ia, ib):
        ib = list(reversed(ib))
    seam_sides.append((list(ia), list(ib)))
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
    # Shell thickness is a PER-BLOCK hint: heavy long drafts with tight chest
    # contact (the tee at its true length) tunnel through a 3 mm shell and
    # trap verts inside — they need 6 mm. But a fat shell also fattens the
    # arms, and snug long-sleeve tubes (hugo, sven) ruche and tear on it, so
    # thick can't be the default.
    _shell = float(DATA.get("sim", {}).get("shellMm", 3.0)) / 1000.0
    col.settings.thickness_outer = _shell
    col.settings.thickness_inner = _shell * 2 / 3
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


BODY_OBJ = build_body()


def build_fit_tape():
    """Thin near-black rings at the classic dress-form landmark lines (bust /
    waist / hip). Real forms carry style tape there, and it's what the
    industry-standard fit mannequins (AlvaForm) show — the horizontal
    reference grid a fitter judges hem levelness and balance against. Built
    as a separate non-colliding object so the cloth ignores it."""
    def ab_at(by):
        if by <= TORSO[0][0]:
            return None
        for (y0, a0, b0), (y1, a1, b1) in zip(TORSO, TORSO[1:]):
            if by <= y1:
                t = (by - y0) / (y1 - y0)
                return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
        return None

    marks = [270.0, 460.0] if BODY_KIND == "upper" else [460.0, 575.0]
    verts, faces = [], []
    N = 48
    for by in marks:
        if by < TORSO[0][0] + 15 or by > _HEM_BY - 15:
            continue
        ab = ab_at(by)
        if not ab:
            continue
        a, b = ab[0] + 1.5, ab[1] + 1.5
        rows = []
        for dz in (-3.0, 3.0):
            start = len(verts)
            for i in range(N):
                t = 2 * math.pi * i / N
                verts.append((a * math.cos(t) * S, b * math.sin(t) * S, z_of_body(by + dz)))
            rows.append(start)
        r0, r1 = rows
        for i in range(N):
            j = (i + 1) % N
            faces.append((r0 + i, r0 + j, r1 + j, r1 + i))
    if not verts:
        return
    m = bpy.data.meshes.new("fit_tape")
    m.from_pydata(verts, [], faces)
    m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    mat_t = bpy.data.materials.new("tape_black")
    mat_t.use_nodes = True
    nt = mat_t.node_tree.nodes["Principled BSDF"]
    nt.inputs["Base Color"].default_value = (0.03, 0.03, 0.03, 1.0)
    nt.inputs["Roughness"].default_value = 0.9
    m.materials.append(mat_t)
    o = bpy.data.objects.new("fit_tape", m)
    bpy.context.collection.objects.link(o)


build_fit_tape()

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
# Bending resists the fine accordion folds that read as "rings" on sleeves
# and legs — per-block hint. Tested: 3.0 on the raglan hoodie traded rings
# for tented shoulders and gaping side seams, so no block uses this yet; the
# ring artifacts stay quarantined by the prompt clause instead.
st.bending_stiffness = float(DATA.get("sim", {}).get("bending", 1.0))
st.vertex_group_mass = "pin"
for name in ("use_sewing_springs", "use_sewing"):
    if hasattr(st, name):
        setattr(st, name, True)
if hasattr(st, "sewing_force_max"):
    # The garment starts nearly assembled — gentle stitching only. Strong
    # sewing forces whip the light cloth into permanent crumples. Darted
    # blocks ask for more via the sim hint (darts fight the side seams).
    # (Sew-force ramps were tried against shell tunneling — 25 frames starved
    # seam closure, 8 frames didn't stop the tunneling. The per-block shell
    # thickness below is the actual cure; constant force stays.)
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
# Warm unbleached-muslin ecru, not pure white: the real-world toile is
# calico, and the warm cast is part of what makes a fitting prototype read
# as cloth instead of CG.
bsdf.inputs["Base Color"].default_value = (0.85, 0.81, 0.70, 1.0)
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

# ---- Fit map: welded-seam relaxation + true girth strain vs the FLAT pattern --
# How the professional tools earn a trustworthy strain map (CLO/MD, Style3D,
# GarmentCodeData): seams carry NO force at equilibrium — they are welded
# topology or satisfied zero-rest-length constraints — and strain is measured
# per triangle against the 2D pattern, resolved along warp/weft. Blender's
# sewing springs stay tensioned forever, so we do what the industry does in
# a small numpy post-pass: weld the seam vertex pairs, relax edge lengths
# toward their flat-pattern rest (averaged-Jacobi PBD), keep the cloth
# outside the mannequin with sliding one-sided contact planes, then measure
# the right Cauchy-Green tensor per triangle. Tightness = girth stretch
# (lambda_weft - 1), clamped at zero: compression is slack, not fit. The
# fit classification is shown only where the garment touches the form —
# free-hanging cloth has no "fit" (CLO does the same).
#
# CALIBRATION RECORD (and why DRAPE_FITMAP stays off by default): the
# spring-only relax converged to a false floor (girth p95 +98% on the tee)
# because Blender's sewing only pairs the sparse ORIGINAL pattern points —
# the subdivision verts along piece boundaries were never sewn, welded, or
# constrained, and the bake leaves them up to 137mm from their seam. The
# densified closure below (every boundary vert, subdivision verts included,
# arc-matched onto the opposite side as a zero-rest point-on-segment
# constraint) removed that floor: seams close from 137mm to ~0.1mm, darts
# to 0.09mm, and every rho/refresh config converges to the same optimum
# (post-extrapolation hard contact projection was chaotically unstable;
# in-sweep contact is not). Fitted blocks now grade credibly — bella reads
# median +4% girth, snug at bust/waist, exactly what a darted bodice
# should say. What remains is NOT a solver artifact: the tee still grades
# hot in the neck-to-armscye band (p95 ~+64%) because the render pose
# splays the arms 30deg for the airy tee stance, parking the pinned cap
# rings ~92mm from where the panels' armscye edges live — the closed
# garment genuinely cannot span that pose unstretched. Proven by freeing
# every pin (and letting scaffold rings drift rigidly): the band persists
# anchor-free. The fix is a pose calibration (arms at ~10deg for fit
# grading, cap rings at the arm root), not more relaxation.
if FRAMES > 0 and _os.environ.get("DRAPE_FITMAP") == "1":
    import numpy as np
    from mathutils.bvhtree import BVHTree

    # Raw cloth result (pre-smooth: the cosmetic pass distorts edge lengths
    # in wrinkled zones).
    sm.show_viewport = False
    sm.show_render = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = obj.evaluated_get(deps).to_mesh()
    nv = len(me.vertices)
    x = np.array([v.co[:] for v in me.vertices], dtype=np.float64)
    flat = np.array(all_flat, dtype=np.float64) * S  # mm -> metres
    tris = np.array(all_faces, dtype=np.int64)
    # Only FACE edges are cloth. The mesh also carries the loose sewing edges
    # Blender used as springs — their endpoints live on different panels
    # whose flat layouts overlap, so their "rest length" is meaningless
    # garbage that poisons both the relax and the statistics.
    face_edges = set()
    for tri in all_faces:
        for k in range(3):
            a2, b2 = tri[k], tri[(k + 1) % 3]
            face_edges.add((a2, b2) if a2 < b2 else (b2, a2))
    edges = np.array(sorted(face_edges), dtype=np.int64)
    invw = np.ones(nv)
    invw[list(pin_indices)] = 0.0

    # Weld seams: union-find over the sew pairs -> shared representatives.
    # Mesh edges never cross panels, so every edge keeps a valid rest length
    # from its own piece's flat coordinates.
    parent = np.arange(nv)

    def _find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for va, vb in sew_edges:
        ra, rb = _find(va), _find(vb)
        if ra != rb:
            parent[rb] = ra
    remap = np.array([_find(i) for i in range(nv)])
    # Welded representative position: clusters that contain a PINNED member
    # sit exactly at the mean of their pinned members — that is where the
    # garment truly hangs. Averaging free members in too (and then freezing
    # the cluster) would permanently bake half of any unclosed seam gap into
    # the measurement.
    pinned_mask = np.zeros(nv, dtype=bool)
    pinned_mask[list(pin_indices)] = True
    accp = np.zeros((nv, 3))
    accn = np.zeros(nv)
    np.add.at(accp, remap, x)
    np.add.at(accn, remap, 1.0)
    accp_pin = np.zeros((nv, 3))
    accn_pin = np.zeros(nv)
    np.add.at(accp_pin, remap[pinned_mask], x[pinned_mask])
    np.add.at(accn_pin, remap[pinned_mask], 1.0)
    mean_all = accp / np.maximum(accn, 1)[:, None]
    mean_pin = accp_pin / np.maximum(accn_pin, 1)[:, None]
    x = np.where(accn_pin[:, None] > 0, mean_pin, np.where(accn[:, None] > 0, mean_all, x))
    # Welded (seam) clusters relax FREE even when they contain pinned verts:
    # the pins are placement scaffolding, and freezing seams at scaffold
    # positions tears every dense seam's unpaired neighbours across the
    # bake's residual gaps. Only unsewn pins (necklines, waistbands) stay
    # anchored — they are the garment's true hang points.
    in_weld = np.zeros(nv, dtype=bool)
    for va, vb in sew_edges:
        in_weld[remap[va]] = True
        in_weld[remap[vb]] = True
    invw = np.ones(nv)
    invw[pinned_mask & ~in_weld[remap]] = 0.0

    ei = remap[edges[:, 0]]
    ej = remap[edges[:, 1]]
    keep = ei != ej
    ei, ej = ei[keep], ej[keep]
    L0 = np.linalg.norm(flat[edges[keep, 0]] - flat[edges[keep, 1]], axis=1)
    ok = L0 > 1e-9
    ei, ej, L0 = ei[ok], ej[ok], L0[ok]
    x_drape = x.copy()

    # Densified seam closure. The seam springs/welds only cover the ORIGINAL
    # pattern points: subdivide_edges quadruples the boundary density with
    # verts that boundary_index never sees, and those unpaired verts keep
    # the bake's seam gap frozen in as local stretch — the converged floor
    # of the spring-only relax. Fix: recover each seam side's TRUE dense
    # vertex list geometrically (every mesh vert lying on the side's flat
    # polyline — subdivision verts sit exactly on it), parameterize both
    # sides by flat arc length, and constrain every vert to the point at
    # the same arc fraction on the opposite side (zero-rest point-on-
    # segment constraints, both directions) — the hard pairing garment
    # CAD uses.
    _pnames = [p["name"] for p in DATA["pieces"]]
    _pr = {}
    for _k, _nm in enumerate(_pnames):
        _pr[_nm] = (offsets[_nm], offsets[_pnames[_k + 1]] if _k + 1 < len(_pnames) else len(all_verts))

    def _dense_side(idxs):
        """(indices, arc params in [0,1]) of ALL piece verts on the side's
        flat polyline, subdivision verts included, ordered by arc length."""
        poly = flat[np.asarray(idxs)]
        s0p, s1p = next(r for nm, r in _pr.items() if r[0] <= idxs[0] < r[1])
        cand = np.arange(s0p, s1p)
        pts = flat[cand]
        seg = np.diff(poly, axis=0)
        seglen = np.linalg.norm(seg, axis=1)
        cum = np.concatenate([[0.0], np.cumsum(seglen)])
        best_d = np.full(len(cand), 1e9)
        best_s = np.zeros(len(cand))
        for k in range(len(seg)):
            if seglen[k] < 1e-12:
                continue
            t = np.clip((pts - poly[k]) @ seg[k] / seglen[k] ** 2, 0.0, 1.0)
            dk = np.linalg.norm(pts - (poly[k] + t[:, None] * seg[k]), axis=1)
            upd = dk < best_d
            best_d[upd] = dk[upd]
            best_s[upd] = cum[k] + t[upd] * seglen[k]
        on = best_d < 0.0005  # within 0.5 mm of the seam line
        order = np.argsort(best_s[on])
        return cand[on][order], best_s[on][order] / max(cum[-1], 1e-12)

    cA, cB0, cB1, cT, cS = [], [], [], [], []

    def _attach(si, sp, di, dp, sidx):
        for i in range(len(si)):
            k = min(max(int(np.searchsorted(dp, sp[i])), 1), len(di) - 1)
            t = (sp[i] - dp[k - 1]) / max(dp[k] - dp[k - 1], 1e-12)
            cA.append(remap[si[i]])
            cB0.append(remap[di[k - 1]])
            cB1.append(remap[di[k]])
            cT.append(min(max(t, 0.0), 1.0))
            cS.append(sidx)

    for _si, (_sa, _sb) in enumerate(seam_sides):
        _ai, _ap = _dense_side(_sa)
        _bi, _bp = _dense_side(_sb)
        if len(_ai) >= 2 and len(_bi) >= 2:
            _attach(_ai, _ap, _bi, _bp, _si)
            _attach(_bi, _bp, _ai, _ap, _si)
    cA, cB0, cB1, cS = np.array(cA), np.array(cB0), np.array(cB1), np.array(cS)
    cT = np.array(cT)
    # Drop constraints already welded onto their target endpoint — zero work,
    # and their zero-length segment direction is undefined.
    _dg = ((cA == cB0) & (cT < 1e-6)) | ((cA == cB1) & (cT > 1 - 1e-6)) | ((cA == cB0) & (cA == cB1))
    # ...and constraints whose every participant is pinned: nothing can move.
    _dg |= (invw[cA] + (1 - cT) ** 2 * invw[cB0] + cT ** 2 * invw[cB1]) < 1e-9
    cA, cB0, cB1, cT, cS = cA[~_dg], cB0[~_dg], cB1[~_dg], cT[~_dg], cS[~_dg]

    def _seam_gap(pos):
        tgt = (1 - cT)[:, None] * pos[cB0] + cT[:, None] * pos[cB1]
        return np.linalg.norm(pos[cA] - tgt, axis=1)

    def _seam_name(si):
        s = DATA["seams"][si]
        return s.get("name") or f'{s["a"][0]}.{s["a"][1]}-{s["b"][0]}.{s["b"][1]}'

    if len(cA):
        _g = _seam_gap(x) * 1000
        print(f"fit seams: {len(cA)} closure constraints, pre gap mm p50={np.percentile(_g,50):.2f} "
              f"p95={np.percentile(_g,95):.2f} max={_g.max():.2f}")
        if _os.environ.get("DRAPE_FIT_DEBUG") == "1":
            for si in np.unique(cS):
                gs = _g[cS == si]
                print(f"  seam {_seam_name(si)}: n={len(gs)} gap p50={np.percentile(gs,50):.1f} max={gs.max():.1f}mm")

    # Mannequin BVH for sliding contact planes (vertices may slide along the
    # form but not through it — freezing them would corrupt the strain field
    # exactly in the tight zones being graded).
    bm_body = BODY_OBJ.data
    bvh = BVHTree.FromPolygons(
        [v.co[:] for v in bm_body.vertices],
        [tuple(p.vertices) for p in bm_body.polygons],
    )
    OFFSET = 0.003

    def contact_planes(pos):
        q = np.zeros((nv, 3))
        nrm = np.zeros((nv, 3))
        dist = np.full(nv, 1e9)
        for i in range(nv):
            hit = bvh.find_nearest(pos[i].tolist())
            if hit[0] is not None:
                q[i] = hit[0][:]
                nrm[i] = hit[1][:]
                dist[i] = hit[3]
        return q, nrm, dist

    # Averaged-Jacobi PBD relaxation toward the flat rest lengths (Macklin
    # et al. 2014 constraint averaging + SOR), with a weak tether to the
    # baked drape that fixes the sliding null-space like friction would.
    OMEGA = float(_os.environ.get("DRAPE_FIT_OMEGA", "1.7"))
    N_ITER = int(_os.environ.get("DRAPE_FIT_ITERS", "5000"))
    # No drape tether: over hundreds of sweeps even a 1e-3 pull is a strong
    # anchor that drags the relax back toward the spring-tensioned bake —
    # reintroducing exactly the assembly tension being removed. The pins fix
    # the gauge; contact keeps the cloth on the body.
    TETHER = float(_os.environ.get("DRAPE_FIT_TETHER", "0"))

    def _edge_strain_stats(pos):
        L = np.linalg.norm(pos[ei] - pos[ej], axis=1)
        s = (L - L0) / L0
        return np.percentile(s, 50), np.percentile(s, 95), np.abs(s).max()

    print("fit relax pre :", "p50=%+.3f p95=%+.3f max=%.3f" % _edge_strain_stats(x))
    if _os.environ.get("DRAPE_FIT_DEBUG") == "1":
        _L = np.linalg.norm(x[ei] - x[ej], axis=1)
        _s = (_L - L0) / L0
        for k in np.argsort(_s)[-6:]:
            a3, b3 = ei[k], ej[k]
            pc = next(nm for nm, of in sorted(offsets.items(), key=lambda t: -t[1]) if of <= a3)
            print(
                f"  worst edge {a3}-{b3} piece={pc} rest={L0[k]*1000:.2f}mm cur={_L[k]*1000:.1f}mm "
                f"flat_a=({all_flat[a3][0]:.1f},{all_flat[a3][1]:.1f}) flat_b=({all_flat[b3][0]:.1f},{all_flat[b3][1]:.1f})"
            )
        _sizes = np.bincount(np.bincount(remap[remap != np.arange(nv)]) + 1) if (remap != np.arange(nv)).any() else []
        _csz = np.bincount(remap)
        _csz = _csz[_csz > 1]
        print(f"  weld clusters: n={len(_csz)} max_size={_csz.max() if len(_csz) else 0} "
              f">4: {(int((_csz > 4).sum()) if len(_csz) else 0)}")
        _tail = _s > 0.5
        if _tail.any():
            _ys = np.concatenate([x[ei[_tail]][:, 2], x[ej[_tail]][:, 2]])
            print(f"  strain>50% edges: {int(_tail.sum())} z-range {(np.percentile(_ys,5)):.3f}..{np.percentile(_ys,95):.3f} "
                  f"(garment z 0..{x[:,2].max():.3f}); pinned-endpoint share "
                  f"{float(((invw[ei[_tail]]==0)|(invw[ej[_tail]]==0)).mean()):.2f}")
    # Chebyshev semi-iterative acceleration (Wang, SIGGRAPH Asia 2015) wraps
    # the averaged-Jacobi sweep: unclosed seam gaps from the bake can be
    # tens of mm, and plain Jacobi transports closure ~one vertex ring per
    # sweep — Chebyshev makes that global.
    # RHO 0.999 with 5000 sweeps is the calibrated sweet spot on the tee
    # probe (girth p95 +18%, median +0.9%); 0.9995 overshoots and diverges,
    # 0.992 needs 3x the sweeps for the same depth.
    RHO = float(_os.environ.get("DRAPE_FIT_RHO", "0.999"))
    GAMMA, WARMUP = 0.7, 15
    omega_ch = 1.0
    x_prev = x.copy()
    for it in range(N_ITER):
        if it % 10 == 0:
            q, nrm, _ = contact_planes(x)
        d = x[ei] - x[ej]
        L = np.linalg.norm(d, axis=1) + 1e-12
        wsum = invw[ei] + invw[ej] + 1e-12
        corr = (L - L0) / wsum
        dvec = d / L[:, None] * corr[:, None]
        dx = np.zeros_like(x)
        cnt = np.zeros(nv)
        np.add.at(dx, ei, -invw[ei, None] * dvec)
        np.add.at(dx, ej, invw[ej, None] * dvec)
        np.add.at(cnt, ei, 1.0)
        np.add.at(cnt, ej, 1.0)
        if len(cA):
            # densified seam closure: pull each boundary vert onto its arc-
            # matched point on the opposite side (and the segment toward it)
            tgt = (1 - cT)[:, None] * x[cB0] + cT[:, None] * x[cB1]
            cd = x[cA] - tgt
            cw = invw[cA] + (1 - cT) ** 2 * invw[cB0] + cT ** 2 * invw[cB1] + 1e-12
            lam = cd / cw[:, None]
            np.add.at(dx, cA, -invw[cA, None] * lam)
            np.add.at(dx, cB0, ((1 - cT) * invw[cB0])[:, None] * lam)
            np.add.at(dx, cB1, (cT * invw[cB1])[:, None] * lam)
            np.add.at(cnt, cA, 1.0)
            np.add.at(cnt, cB0, 1.0)
            np.add.at(cnt, cB1, 1.0)
        # Contact joins the averaged sweep as one more constraint, so the
        # Chebyshev extrapolation sees a consistent operator. Hard-projecting
        # AFTER the accelerated step is chaotically unstable (identical
        # configs scattered girth p95 anywhere from +0.6 to +1.8 depending
        # on BVH normal noise); in-sweep contact converges to the same
        # optimum from every rho/refresh setting tested.
        pen = OFFSET - np.einsum("ij,ij->i", x - q, nrm)
        push = np.maximum(pen, 0.0)
        dx += nrm * (push * invw)[:, None]
        cnt += (push > 0).astype(float)
        x_new = x + OMEGA * dx / np.maximum(cnt, 1.0)[:, None]
        x_new += TETHER * (x_drape - x_new) * invw[:, None]
        if it < WARMUP:
            omega_ch = 1.0
        elif it == WARMUP:
            omega_ch = 2.0 / (2.0 - RHO * RHO)
        else:
            omega_ch = 4.0 / (4.0 - RHO * RHO * omega_ch)
        x_acc = omega_ch * (GAMMA * (x_new - x) + x - x_prev) + x_prev
        x_prev = x
        x = np.where(invw[:, None] > 0, x_acc, x)
    # one exact projection at the end so nothing renders inside the form
    q, nrm, _ = contact_planes(x)
    pen = OFFSET - np.einsum("ij,ij->i", x - q, nrm)
    x += nrm * (np.maximum(pen, 0.0) * invw)[:, None]
    print("fit relax post:", "p50=%+.3f p95=%+.3f max=%.3f" % _edge_strain_stats(x),
          "maxdisp=%.4f" % np.abs(x - x_drape).max())
    if len(cA):
        _g = _seam_gap(x) * 1000
        print(f"fit seams post: gap mm p50={np.percentile(_g,50):.2f} p95={np.percentile(_g,95):.2f} max={_g.max():.2f}")
    if _os.environ.get("DRAPE_FIT_DEBUG") == "1":
        _pc = lambda gi: next(nm for nm, of in sorted(offsets.items(), key=lambda t: -t[1]) if of <= gi)
        _L = np.linalg.norm(x[ei] - x[ej], axis=1)
        _s = (_L - L0) / L0
        for k in np.argsort(_s)[-6:]:
            a3, b3 = ei[k], ej[k]
            print(f"  post worst edge {a3}-{b3} piece={_pc(a3)} rest={L0[k]*1000:.2f}mm cur={_L[k]*1000:.1f}mm "
                  f"flat_a=({all_flat[a3][0]:.1f},{all_flat[a3][1]:.1f}) flat_b=({all_flat[b3][0]:.1f},{all_flat[b3][1]:.1f})")
    if _os.environ.get("DRAPE_FIT_DUMP"):
        np.savez_compressed(
            _os.environ["DRAPE_FIT_DUMP"],
            x_drape=x_drape, x_relaxed=x, flat=flat, remap=remap, invw=invw,
            ei=ei, ej=ej, L0=L0, tris=tris, cA=cA, cB0=cB0, cB1=cB1, cT=cT, cS=cS,
            body_verts=np.array([v.co[:] for v in bm_body.vertices]),
            # fan-triangulate: quads truncated to one triangle would leave
            # holes in the offline BVH and understate contact
            body_tris=np.array([
                (q[0], q[k], q[k + 1])
                for p in bm_body.polygons
                for q in [tuple(p.vertices)]
                for k in range(1, len(q) - 1)
            ]),
        )
        print(f"fit dump written: {_os.environ['DRAPE_FIT_DUMP']}")

    # Per-triangle right Cauchy-Green from the 2D->3D deformation gradient:
    # C = F^T F with F = Ds Dm^-1; lambda_weft = sqrt(C00) is the girth
    # stretch (pattern x IS the girth axis in every block we emit).
    t0, t1, t2 = remap[tris[:, 0]], remap[tris[:, 1]], remap[tris[:, 2]]
    u0, u1, u2 = flat[tris[:, 0]], flat[tris[:, 1]], flat[tris[:, 2]]
    Dm = np.stack([u1 - u0, u2 - u0], axis=2)  # (T,2,2)
    detDm = Dm[:, 0, 0] * Dm[:, 1, 1] - Dm[:, 0, 1] * Dm[:, 1, 0]
    good = np.abs(detDm) > 1e-12
    Dm_inv = np.zeros_like(Dm)
    Dm_inv[good, 0, 0] = Dm[good, 1, 1] / detDm[good]
    Dm_inv[good, 0, 1] = -Dm[good, 0, 1] / detDm[good]
    Dm_inv[good, 1, 0] = -Dm[good, 1, 0] / detDm[good]
    Dm_inv[good, 1, 1] = Dm[good, 0, 0] / detDm[good]
    Ds = np.stack([x[t1] - x[t0], x[t2] - x[t0]], axis=2)  # (T,3,2)
    F = Ds @ Dm_inv
    C = np.einsum("tik,til->tkl", F, F)
    lam_weft = np.sqrt(np.maximum(C[:, 0, 0], 0.0))
    # Pinned verts are artificial hanging scaffolding frozen at placed
    # positions — triangles touching them measure the scaffold, not relaxed
    # cloth, and junctions between two pinned clusters can never relax at
    # all. Exclude them like the free-hanging regions.
    free_tri = (invw[t0] > 0) & (invw[t1] > 0) & (invw[t2] > 0)
    tight_tri = np.where(good & free_tri, lam_weft - 1.0, 0.0)
    areaT = np.where(free_tri, np.abs(detDm) * 0.5, 0.0)

    tight_v = np.zeros(nv)
    area_v = np.zeros(nv)
    for k in range(3):
        vv = remap[tris[:, k]]
        np.add.at(tight_v, vv, tight_tri * areaT)
        np.add.at(area_v, vv, areaT)
    tight = np.where(area_v > 0, tight_v / np.maximum(area_v, 1e-12), 0.0)

    # Fit exists only where the garment meets the body (CLO computes its fit
    # map the same way); free-hanging cloth shows neutral. Pinned regions
    # (no measured area) also fall out here.
    _, _, dist = contact_planes(x)
    in_contact = (dist < 0.012) & (area_v > 0)
    if _os.environ.get("DRAPE_FIT_DEBUG") == "1":
        _pc = lambda gi: next(nm for nm, of in sorted(offsets.items(), key=lambda t: -t[1]) if of <= gi)
        _tail_v = [i for i in range(nv) if in_contact[remap[i]] and tight[remap[i]] > 0.5]
        from collections import Counter
        _byp = Counter(_pc(i) for i in _tail_v)
        print(f"  girth>50% contact verts: {len(_tail_v)} by piece {dict(_byp)}")
        for i in _tail_v[:: max(1, len(_tail_v) // 6)][:6]:
            print(f"    vert {i} piece={_pc(i)} flat=({all_flat[i][0]:.0f},{all_flat[i][1]:.0f}) "
                  f"z={x[remap[i]][2]:.3f} girth={tight[remap[i]]:+.2f}")

    def strain_color(s, contact):
        if not contact:
            return (0.62, 0.66, 0.62)  # free-hanging: neutral, no "fit" there
        if s < -0.02:
            return (0.45, 0.62, 0.85)  # slack pooling against the body
        # CLO's strain map runs 100->120% (red at +20%); we go red at +15%,
        # slightly stricter, with yellow ("snug") from +5%.
        stops = [(0.0, (0.30, 0.65, 0.34)), (0.05, (0.92, 0.85, 0.25)), (0.15, (0.85, 0.13, 0.10))]
        if s <= 0.0:
            return stops[0][1]
        for (s0, c0), (s1, c1) in zip(stops, stops[1:]):
            if s <= s1:
                t = (s - s0) / (s1 - s0)
                return tuple(a + (b - a) * t for a, b in zip(c0, c1))
        return stops[-1][1]

    attr = obj.data.color_attributes.new("strain_col", "FLOAT_COLOR", "POINT")
    for i in range(nv):
        r_i = remap[i]
        r, g, b = strain_color(tight[r_i], bool(in_contact[r_i]))
        attr.data[i].color = (r, g, b, 1.0)
    sm.show_viewport = True
    sm.show_render = True
    print(
        f"fit relax: girth strain p50={np.percentile(tight[in_contact], 50) if in_contact.any() else 0:+.3f} "
        f"p95={np.percentile(tight[in_contact], 95) if in_contact.any() else 0:+.3f} contact {int(in_contact.sum())}/{nv}"
    )

    fit_mat = bpy.data.materials.new("fit_map")
    fit_mat.use_nodes = True
    fnodes = fit_mat.node_tree.nodes
    flinks = fit_mat.node_tree.links
    fb = fnodes["Principled BSDF"]
    ca = fnodes.new("ShaderNodeVertexColor")
    ca.layer_name = "strain_col"
    flinks.new(ca.outputs["Color"], fb.inputs["Base Color"])
    fb.inputs["Roughness"].default_value = 1.0
    obj.data.materials.clear()
    obj.data.materials.append(fit_mat)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    FIT_PNG = OUT_PNG.replace(".png", "-fit.png")
    scene.render.filepath = FIT_PNG
    bpy.ops.render.render(write_still=True)
    print(f"fit map written: {FIT_PNG}")
