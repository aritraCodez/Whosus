import bpy
from pathlib import Path

root=Path('D:/my project/whosus/pokemon')
if bpy.data.filepath != str(root/'pokemon-roster.blend'):
    bpy.ops.wm.open_mainfile(filepath=str(root/'pokemon-roster.blend'))
expected={'Pokemon | '+name.title() for name in ['eevee','pikachu','rowlet','sprigatito','piplup','jigglypuff','togepi','squirtle','charizard']}
assert set(bpy.data.scenes.keys())==expected
for scene in bpy.data.scenes:
    assert scene.camera and scene.world
    meshes=[o for o in scene.objects if o.type=='MESH']
    assert len(meshes)>15
    assert any('Editable character' in c.name for c in scene.collection.children)
window=bpy.context.window_manager.windows[0]
window.scene=bpy.data.scenes['Pokemon | Eevee']
for area in window.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'pokemon-roster.blend'),compress=True)
individuals=[]
for path in (root/'characters').glob('*.blend'):
    with bpy.data.libraries.load(str(path)) as (source,target):
        assert source.scenes==['Pokemon | '+path.stem.title()]
        individuals.append(path.name)
result={'project':bpy.data.filepath,'scenes':sorted(bpy.data.scenes.keys()),'individuals':individuals,'editable':True}
