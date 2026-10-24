import bpy
from pathlib import Path

root=Path('D:/my project/whosus')
scene=bpy.data.scenes['Mosslight | Game assets']
bpy.context.window.scene=scene
if scene.get('forest_detail_added'):
    raise RuntimeError('Forest ground cover has already been added.')
terrain=bpy.data.collections['Game | Mosslight forest map']
terrain.hide_viewport=False
terrain.hide_render=False
exec((root/'whosus_frontend/assets/mosslight_forest_detail.py').read_text(encoding='utf-8'))
add_forest_detail(terrain)
groups={}
for obj in list(terrain.objects):
    groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for name,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:
        bpy.ops.object.join()
    bpy.context.object.name='Mosslight_Map_'+name.split('|')[-1].strip().replace(' ','_')
bpy.ops.object.select_all(action='DESELECT')
for obj in terrain.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'whosus_frontend/public/models/mosslight-map.glb'),
    export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_yup=True,export_apply=True)
terrain.hide_viewport=True
terrain.hide_render=True
scene['forest_detail_added']=True
bpy.ops.wm.save_as_mainfile(filepath=str(root/'whosus_frontend/public/models/mosslight-game.blend'))
result={'map_saved':True,'map_meshes':len(terrain.objects)}
