import bpy

def clean():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
clean()

bpy.ops.wm.obj_import(filepath='/tmp/wardrobe/sheath_flat.obj', up_axis='Y', forward_axis='NEGATIVE_Z')
gar = bpy.context.selected_objects[0]; gar.name='garment'
bpy.ops.wm.obj_import(filepath='/tmp/wardrobe/body.obj', up_axis='Y', forward_axis='NEGATIVE_Z')
bod = bpy.context.selected_objects[0]; bod.name='body'

# Pre-shape the round box-mesh tube toward the body's ellipse, but TAPER the
# squash by height: full width at the shoulders (so the straps sit correctly),
# ramping to full squash at bust and below. Prevents shoulder/neck distortion.
me = gar.data
cx = sum(v.co.x for v in me.vertices)/len(me.vertices)
cz = sum(v.co.z for v in me.vertices)/len(me.vertices)
SX, SZ = 0.80, 0.55
Y_SH, Y_BUST = 1.35, 1.12   # above shoulder: no squash; at/below bust: full
def fac(y, S):
    if y >= Y_SH: return 1.0
    if y <= Y_BUST: return S
    t = (Y_SH - y) / (Y_SH - Y_BUST)
    return 1.0 + (S - 1.0) * t
for v in me.vertices:
    v.co.x = cx + (v.co.x - cx) * fac(v.co.y, SX)
    v.co.z = cz + (v.co.z - cz) * fac(v.co.y, SZ)

scene = bpy.context.scene
scene.gravity = (0.0, -9.81, 0.0)
scene.frame_start = 1; scene.frame_end = 140

ys = [v.co.y for v in me.vertices]; ymax = max(ys)
vg = gar.vertex_groups.new(name='pin')
vg.add([v.index for v in me.vertices if v.co.y > ymax - 0.02], 1.0, 'REPLACE')
for p in me.polygons: p.use_smooth = True

bpy.context.view_layer.objects.active = gar
cmod = gar.modifiers.new('Cloth','CLOTH'); cs = cmod.settings
cs.quality = 8
cs.mass = 0.28
cs.tension_stiffness = 4; cs.compression_stiffness = 4; cs.shear_stiffness = 4
cs.bending_stiffness = 0.06
cs.air_damping = 1.0
cs.shrink_min = 0.0
cs.vertex_group_mass = 'pin'
col = cmod.collision_settings
col.use_collision = True; col.use_self_collision = True
col.self_distance_min = 0.004; col.distance_min = 0.006; col.collision_quality = 6
bpy.context.view_layer.objects.active = bod
bod.modifiers.new('Collision','COLLISION')
bod.collision.thickness_outer = 0.007; bod.collision.thickness_inner = 0.02
bod.collision.cloth_friction = 10

dg = bpy.context.evaluated_depsgraph_get()
for f in range(scene.frame_start, scene.frame_end+1):
    scene.frame_set(f); dg.update()
    if f % 25 == 0: print('  frame', f)
print('SIM DONE at frame', scene.frame_current)

bpy.ops.object.select_all(action='DESELECT')
gar.select_set(True); bpy.context.view_layer.objects.active = gar
bpy.ops.export_scene.gltf(filepath='/tmp/wardrobe/sheath_draped.glb', use_selection=True, export_apply=True, export_yup=True)
print('EXPORTED')
