# Garment drape research (archived)

This directory holds the reference scripts from an investigation into **physics
cloth simulation** for the Fitting Room — draping a real sewn garment on a 3D
body entirely on CPU, in-repo, with no GPU and no paid service.

**Status: archived research, not wired into the app.** It works, but the output
is a *slim, body-following but not premium* drape (coarse-mesh ribbing, some
seam blousing), and it can only ever be **pre-baked offline** — Blender can't
run per shopper in a browser. The product Fitting Room instead uses on-platform
**AI image generation** ("On a model" view) for the garment-on-a-body
experience, which is dramatically more convincing and needs no simulation. See
the commit history and `src/worker/routes/admin-fitting.ts` (`/tryon`).

Kept here because the pipeline is genuinely useful for a future **pre-baked
wardrobe** of hero garments, or for anyone who wants real 3D drape without a GPU.

## Pipeline

1. **`_gen_reference.py`** — GarmentCode (`pygarment`, MIT) builds a sewing
   pattern and sews it into a 3D "box mesh" garment, exported as OBJ (metres).
   Runs in a venv with `pygarment`, `trimesh`. Needs a GarmentCode checkout on
   `PYTHONPATH` (for `assets/…`) and a body — `assets/bodies/mean_female.obj`
   (CC-BY, **not** SMPL).
2. **`_drape_reference.py`** — Blender (`--background --python`) drapes the
   garment on the body with the Cloth modifier. Key tricks that took many
   iterations to find:
   - The box mesh comes out as a near-**round tube** (~0.48 wide × 0.55 deep),
     but a real torso is a flat **ellipse** (~0.32 × 0.22). So we **pre-shape**
     the tube toward that ellipse — squashing Z far more than X — *tapered by
     height* so the shoulders keep their true width. Without this the garment
     barrels and the model looks ~2× her weight.
   - Pin only the top collar ring; soft cloth (low tension/bending); body
     Collision with a few-mm outer thickness so fabric sits just outside the
     skin (too tight → the body pokes through).

## Licensing (verified)

- GarmentCode / `pygarment`: **MIT**. `mean_female.obj` body: **CC-BY 4.0**
  (CAESAR-based, deliberately **not** SMPL, so it's redistributable).
- Blender: GPL, used only as an offline asset-baking tool — the baked GLB is
  ours.
- For a ready-made alternative with **no simulation at all**, the
  **GarmentCodeData** dataset (CC BY-SA 4.0) ships ~115k garments already draped
  on the same non-SMPL body as OBJ. Avoid BEDLAM / DeepFashion3D / Cloth3D /
  TailorNet (SMPL and/or non-commercial).

## Reproduce (throwaway env)

```sh
# GarmentCode + deps
git clone https://github.com/maria-korosteleva/GarmentCode /tmp/gc
python -m venv /tmp/gv && /tmp/gv/bin/pip install pygarment trimesh pyyaml
# generate the garment mesh (writes /tmp/wardrobe/sheath_flat.obj)
cd /tmp/gc && PYTHONPATH=/tmp/gc /tmp/gv/bin/python .../_gen_reference.py
# drape it (needs Blender 4.x; writes /tmp/wardrobe/sheath_draped.glb)
blender --background --python .../_drape_reference.py
```

The scripts use absolute `/tmp/wardrobe/...` paths from that session; adjust to
taste. This is a reference, not a turnkey CLI.
