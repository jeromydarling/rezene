# Offline fit-relax lab: re-runs the fit-map relaxation from a DRAPE_FIT_DUMP
# npz (see sim.py) without re-baking the cloth sim, so calibration experiments
# take seconds instead of minutes. Runs inside Blender for mathutils' BVH:
#
#   blender -b -noaudio -P scripts/drape/fit_offline.py -- dump.npz [iters] [mode]
#
# Prints the same stats sim.py prints, plus diagnostics on the strain tail.
# Dev tool only — nothing in the product pipeline calls this.
import sys

import numpy as np
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1 :]
D = np.load(argv[0])
N_ITER = int(argv[1]) if len(argv) > 1 else 1500
MODE = argv[2] if len(argv) > 2 else "base"

x = D["x_drape"].copy()
flat, remap, invw = D["flat"], D["remap"], D["invw"]
ei, ej, L0 = D["ei"], D["ej"], D["L0"]
tris = D["tris"]
cA, cB0, cB1, cT, cS = D["cA"], D["cB0"], D["cB1"], D["cT"], D["cS"]
nv = len(x)

bvh = BVHTree.FromPolygons([tuple(v) for v in D["body_verts"]], [tuple(int(i) for i in t) for t in D["body_tris"]])
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


def seam_gap(pos):
    tgt = (1 - cT)[:, None] * pos[cB0] + cT[:, None] * pos[cB1]
    return np.linalg.norm(pos[cA] - tgt, axis=1)


def edge_stats(pos):
    L = np.linalg.norm(pos[ei] - pos[ej], axis=1)
    s = (L - L0) / L0
    return np.percentile(s, 50), np.percentile(s, 95), np.abs(s).max()


def relax(x, n_iter, contact_every=10, omega=1.7, rho=0.992, gamma=0.7, warmup=15, seams=True,
          contact_mode="post", damp=1.0):
    omega_ch = 1.0
    x_prev = x.copy()
    q = nrm = None
    for it in range(n_iter):
        if it % contact_every == 0:
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
        if seams and len(cA):
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
        if contact_mode == "sweep":
            # contact as one more averaged constraint, accelerated with the
            # rest — no post-step projection to destabilize Chebyshev
            pen = OFFSET - np.einsum("ij,ij->i", x - q, nrm)
            push = np.maximum(pen, 0.0)
            dx += nrm * (push * invw)[:, None]
            cnt += (push > 0).astype(float)
        x_new = x + omega * dx / np.maximum(cnt, 1.0)[:, None]
        if it < warmup:
            omega_ch = 1.0
        elif it == warmup:
            omega_ch = 2.0 / (2.0 - rho * rho)
        else:
            omega_ch = 4.0 / (4.0 - rho * rho * omega_ch)
        x_acc = omega_ch * (gamma * (x_new - x) + x - x_prev) + x_prev
        x_prev = x
        x = np.where(invw[:, None] > 0, x_acc, x)
        if contact_mode != "sweep":
            pen = OFFSET - np.einsum("ij,ij->i", x - q, nrm)
            x += nrm * (damp * np.maximum(pen, 0.0) * invw)[:, None]
    if contact_mode == "sweep":
        # one exact projection at the end so nothing renders inside the form
        q, nrm, _ = contact_planes(x)
        pen = OFFSET - np.einsum("ij,ij->i", x - q, nrm)
        x += nrm * (np.maximum(pen, 0.0) * invw)[:, None]
    return x


def girth(x):
    t0, t1, t2 = remap[tris[:, 0]], remap[tris[:, 1]], remap[tris[:, 2]]
    u0, u1, u2 = flat[tris[:, 0]], flat[tris[:, 1]], flat[tris[:, 2]]
    Dm = np.stack([u1 - u0, u2 - u0], axis=2)
    detDm = Dm[:, 0, 0] * Dm[:, 1, 1] - Dm[:, 0, 1] * Dm[:, 1, 0]
    good = np.abs(detDm) > 1e-12
    Dm_inv = np.zeros_like(Dm)
    Dm_inv[good, 0, 0] = Dm[good, 1, 1] / detDm[good]
    Dm_inv[good, 0, 1] = -Dm[good, 0, 1] / detDm[good]
    Dm_inv[good, 1, 0] = -Dm[good, 1, 0] / detDm[good]
    Dm_inv[good, 1, 1] = Dm[good, 0, 0] / detDm[good]
    Ds = np.stack([x[t1] - x[t0], x[t2] - x[t0]], axis=2)
    F = Ds @ Dm_inv
    C = np.einsum("tik,til->tkl", F, F)
    lam_weft = np.sqrt(np.maximum(C[:, 0, 0], 0.0))
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
    _, _, dist = contact_planes(x)
    in_contact = (dist < 0.012) & (area_v > 0)
    return tight, in_contact, dist


# ---- orientation sanity: gap-vs-arc profile per seam (a flipped side shows a
# V/linear-crossing profile; a uniform offset is a genuinely open seam) -------
g0 = seam_gap(x) * 1000
for si in np.unique(cS):
    idx = np.where(cS == si)[0]
    gs = g0[idx]
    thirds = np.array_split(gs, 3)
    print(
        f"seam {si}: n={len(gs)} gap thirds p50 = "
        + " / ".join(f"{np.percentile(t, 50):.1f}" for t in thirds)
        + f"  (max {gs.max():.1f}mm)"
    )

print("pre :", "edges p50=%+.3f p95=%+.3f max=%.3f" % edge_stats(x))
# MODE: comma-separated tokens, e.g. "rho999,sweep" or "rho998,damp5,c1"
kw = {}
for tok in MODE.split(","):
    if tok.startswith("rho"):
        kw["rho"] = float("0." + tok[3:])
    elif tok == "sweep":
        kw["contact_mode"] = "sweep"
    elif tok.startswith("damp"):
        kw["damp"] = int(tok[4:]) / 10.0
    elif tok.startswith("c") and tok[1:].isdigit():
        kw["contact_every"] = int(tok[1:])
    elif tok == "noseams":
        kw["seams"] = False
x = relax(x, N_ITER, **kw)
print("post:", "edges p50=%+.3f p95=%+.3f max=%.3f" % edge_stats(x))
g1 = seam_gap(x) * 1000
print(f"seam gaps post: p50={np.percentile(g1,50):.2f} p95={np.percentile(g1,95):.2f} max={g1.max():.2f}mm")

tight, in_contact, dist = girth(x)
tc = tight[in_contact]
print(f"girth strain p50={np.percentile(tc,50):+.3f} p95={np.percentile(tc,95):+.3f} contact {int(in_contact.sum())}/{nv}")

# ---- tail anatomy ------------------------------------------------------------
tail = np.where(in_contact & (tight > 0.5))[0]
print(f"tail verts (>50% girth, contact): {len(tail)}")
if len(tail):
    print(f"  dist-to-body mm: p50={np.percentile(dist[tail],50)*1000:.1f} max={dist[tail].max()*1000:.1f}")
    zs = x[tail][:, 2]
    print(f"  z: {np.percentile(zs,5):.3f}..{np.percentile(zs,95):.3f} (garment {x[:,2].min():.3f}..{x[:,2].max():.3f})")
    # seam shadow: how much of the tail hugs a seam? (1-ring adjacency)
    seam_verts = set(np.concatenate([cA, cB0, cB1]).tolist())
    ring1 = set(seam_verts)
    for t in tris:
        rs = [int(remap[v]) for v in t]
        if any(r in seam_verts for r in rs):
            ring1.update(rs)
    in_shadow = np.array([int(v) in ring1 for v in tail])
    print(f"  tail in 1-ring seam shadow: {int(in_shadow.sum())}/{len(tail)}")
    # grading with the seam shadow excluded (doubled fabric there anyway)
    shadow_arr = np.zeros(nv, dtype=bool)
    shadow_arr[list(ring1)] = True
    keep_g = in_contact & ~shadow_arr
    kg = tight[keep_g]
    print(f"  girth excl. shadow: p50={np.percentile(kg,50):+.3f} p95={np.percentile(kg,95):+.3f} "
          f">15%: {int((kg > 0.15).sum())}/{len(kg)}")
