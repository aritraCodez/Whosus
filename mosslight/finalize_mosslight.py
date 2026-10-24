import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

out=Path('D:/my project/whosus/mosslight')
scene=bpy.data.scenes['Mosslight | Studio']
root=bpy.data.objects['Mosslight | Character root']
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=.1
scene.unit_settings.length_unit='CENTIMETERS'
for obj in scene.objects:
    if obj.name.startswith('Foot |'):
        # Bring each sole into contact with the studio ground.
        min_z=min((obj.matrix_world@v.co).z for v in obj.data.vertices)
        obj.location.z-=min_z-.003
    elif obj.name.startswith('Foot crease |'):
        obj.location.z=-.042
bpy.context.view_layer.update()

character=[o for o in scene.objects if o.type=='MESH' and o.parent==root]
feet=[o for o in character if o.name.startswith('Foot |')]
crystals=[o for o in character if o.name.startswith('Amber |')]
assert len(feet)==4, 'Expected exactly four feet'
assert len(crystals)==6, 'Expected six separate amber shells'
assert all(o.data.uv_layers for o in character), 'Every character mesh must have UV coordinates'
assert all(len(o.data.materials)>0 for o in character), 'Missing material'
assert all(o.data.validate(verbose=False)==False for o in character), 'Invalid mesh geometry was found'

solid_checks={}
for obj in [bpy.data.objects['Body | Broad river-stone torso'],*feet,*crystals]:
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    non_manifold=sum(not e.is_manifold for e in bm.edges)
    volume=bm.calc_volume(signed=True)
    bm.free()
    solid_checks[obj.name]={'non_manifold_edges':non_manifold,'signed_volume':round(volume,5)}
    assert non_manifold==0 and volume>0, 'Expected a closed outward-facing solid: '+obj.name

depsgraph=bpy.context.evaluated_depsgraph_get()
triangles=0
points=[]
for obj in character:
    evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    triangles+=len(mesh.loop_triangles)
    points.extend(world_to_camera_view(scene,scene.camera,evaluated.matrix_world@v.co) for v in mesh.vertices)
    evaluated.to_mesh_clear()
frame_bounds={
    'left':round(min(p.x for p in points),4),
    'right':round(max(p.x for p in points),4),
    'bottom':round(min(p.y for p in points),4),
    'top':round(max(p.y for p in points),4),
}
assert all(0<p.x<1 and 0<p.y<1 and p.z>0 for p in points), 'Character extends beyond camera frame'

scene.render.resolution_percentage=100
scene.cycles.samples=128
scene.cycles.adaptive_threshold=.015
scene.render.filepath=str(out/'mosslight_preview.png')
scene['Asset mesh count']=len(character)
scene['Base polygon count']=sum(len(o.data.polygons) for o in character)
scene['Evaluated triangle count']=triangles
scene['Scale note']='One Blender unit represents 10 cm. The creature is approximately 45 cm wide.'
notes=bpy.data.texts['Mosslight | Read me']
notes.write('\nFinal verification: four feet, six closed crystal shells, all meshes UV mapped.\nAll torso/foot/crystal solids are manifold with outward-facing normals.\nScale: 1 Blender unit = 10 cm. Width approximately 45 cm.\nRender: 128 adaptive Cycles samples, OptiX, denoising, gentle compositor glow.\n')

bpy.ops.wm.save_as_mainfile(filepath=str(out/'mosslight.blend'))
bpy.ops.render.render(write_still=True)
report={
    'project':str(out/'mosslight.blend'),
    'preview':str(out/'mosslight_preview.png'),
    'resolution':[scene.render.resolution_x,scene.render.resolution_y],
    'character_meshes':len(character),
    'base_vertices':sum(len(o.data.vertices) for o in character),
    'base_polygons':sum(len(o.data.polygons) for o in character),
    'evaluated_triangles':triangles,
    'uv_mapped_meshes':sum(bool(o.data.uv_layers) for o in character),
    'feet':[o.name for o in feet],
    'closed_solids':solid_checks,
    'camera_frame_bounds':frame_bounds,
    'original_scene_preserved':'Scene' in bpy.data.scenes,
    'external_texture_dependencies':[],
}
(out/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
result=report
