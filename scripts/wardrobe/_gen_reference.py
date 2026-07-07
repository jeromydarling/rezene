import numpy as np, trimesh, yaml
from pathlib import Path
from pygarment.meshgen.boxmeshgen import BoxMesh, Edge
Edge.name='edge'
from assets.garment_programs.meta_garment import MetaGarment
from assets.bodies.body_params import BodyParameters

d = yaml.safe_load(open('assets/design_params/t-shirt.yaml'))['design']
d['meta']['upper']['v']='FittedShirt'
d['meta']['wb']['v']='FittedWB'
d['meta']['bottom']['v']='PencilSkirt'

d['sleeve']['length']['v']=0.0        # sleeveless -> no armhole gape on the A-pose arms
d['shirt']['length']['v']=1.35        # bodice long enough to meet the waistband (no midriff gap)
d['shirt']['width']['v']=0.9
d['shirt']['flare']['v']=1.0
d['collar']['f_collar']['v']='CircleNeckHalf'
d['collar']['width']['v']=0.25
d['waistband']['waist']['v']=1.0
d['waistband']['width']['v']=0.1
d['pencil-skirt']['length']['v']=0.75
d['pencil-skirt']['flare']['v']=0.95

body = BodyParameters('./assets/bodies/mean_female.yaml')
pat = MetaGarment('sheath', body, d).assembly()
folder = pat.serialize(Path('./Logs'), tag='_sh', to_subfolder=True, with_3d=False, with_text=False, view_ids=False, with_printable=False)
spec = str(Path(folder)/(Path(folder).name+'_specification.json'))

bm = BoxMesh(spec, res=1.0); bm.load()
g = trimesh.Trimesh(np.array(bm.vertices,float)*0.01, np.array(bm.faces,np.int64), process=True)
g.merge_vertices(); g.update_faces(g.nondegenerate_faces()); g.remove_unreferenced_vertices()
g.export('/tmp/wardrobe/sheath_flat.obj')
print('sheath verts', g.vertices.shape[0], 'Y', round(g.vertices[:,1].min(),3), round(g.vertices[:,1].max(),3))
