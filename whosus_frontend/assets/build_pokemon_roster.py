"""Author referenced Pokémon meshes, GLBs, editable scenes, and studio previews.

Execute this file through mosslight/blender_bridge.py against Blender's MCP add-on.
Optional BUILD_NAMES in the execution namespace limits a batch. Existing species
scenes are preserved, so each species can be authored only once per project.
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path('D:/my project/whosus')
SOURCE=ROOT/'whosus_frontend/assets'
exec((SOURCE/'pokemon_builder.py').read_text(encoding='utf-8'))
for file in ['pokemon_models_a.py','pokemon_models_b.py','pokemon_models_c.py']:
    if (SOURCE/file).exists():exec((SOURCE/file).read_text(encoding='utf-8'))
NAMES=globals().get('BUILD_NAMES',['eevee','pikachu','rowlet','sprigatito','piplup','jigglypuff','togepi','squirtle','charizard'])

def export_game(b):
    coll=bpy.data.collections.new(b.name+' | Optimized game meshes')
    b.scene.collection.children.link(coll)
    copies={}
    deps=bpy.context.evaluated_depsgraph_get()
    for src in b.coll.objects:
        obj=src.copy()
        if src.type=='MESH':
            obj.data=bpy.data.meshes.new_from_object(src.evaluated_get(deps),depsgraph=deps)
            obj.modifiers.clear()
        obj.name=src.name+'_Game'
        coll.objects.link(obj)
        copies[src]=obj
    for src,obj in copies.items():obj.parent=copies.get(src.parent)
    bpy.context.view_layer.update()
    groups={}
    for obj in copies.values():
        if obj.type=='MESH':groups.setdefault(obj.parent,[]).append(obj)
    # One editable mesh per animated part; material slots preserve all markings.
    for parent,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        bpy.context.object.name=b.name+'_'+parent.get('part','body')+'_Mesh'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in coll.objects:obj.select_set(True)
    path=ASSETS/(b.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
        export_animations=False,export_extras=True,export_yup=True,export_apply=True)
    triangles=0
    for obj in coll.objects:
        if obj.type=='MESH':
            obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    coll.hide_render=True;coll.hide_viewport=True
    return {'id':b.name,'glb':str(path),'triangles':triangles,'bytes':path.stat().st_size,
        'scene':b.scene.name,'reference':b.root['reference'],'height':b.root['game_height']}

def studio(b):
    scene=b.scene
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012))
    ground=bpy.context.object;ground.name=b.name+'_StudioGround'
    ground.data.materials.append(mat(b.name+' studio','DCE1D8',.9))
    # Studio objects are in the scene root, separate from both model collections.
    for c in list(ground.users_collection):c.objects.unlink(ground)
    scene.collection.objects.link(ground)
    world=bpy.data.worlds.new(b.name+'_StudioWorld');world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs[0].default_value=color('DDE5EB')
    world.node_tree.nodes.get('Background').inputs[1].default_value=.35
    scene.world=world
    for name,pos,energy,size,tint in [('Key',(-3,-4,5),420,4,'FFF1D9'),('Fill',(4,-2,3),260,3,'E4F4FF'),('Rim',(1,3,4),500,3,'FFEDCC')]:
        light=bpy.data.lights.new(b.name+'_'+name,'AREA');light.energy=energy;light.shape='DISK';light.size=size
        light.color=color(tint)[:3]
        obj=bpy.data.objects.new(light.name,light);scene.collection.objects.link(obj);obj.location=pos
        obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new(b.name+'_PreviewCamera');camera=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(camera);camera.location=(2.9,-6.2,3.1)
    camera.rotation_euler=(Vector((0,.05,.80))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=2.65 if b.name!='charizard' else 3.5
    scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.refresh_devices()
    for device in prefs.devices:device.use=device.type=='OPTIX'
    scene.cycles.device='GPU'
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None'
    scene.view_settings.exposure=-.7
    scene.render.filepath=str(OUT/'previews'/(b.name+'.png'))
    bpy.ops.render.render(write_still=True)

reports=[]
for name in NAMES:
    previous=bpy.data.scenes.get('Pokemon | '+name.title())
    if previous:
        if not globals().get('REFINE_MODELS',False):raise RuntimeError('Existing '+name+' scene is preserved; enable REFINE_MODELS for a new revision.')
        previous.name='Draft | '+name.title()
    b=globals()['build_'+name]()
    bpy.context.view_layer.update()
    reports.append(export_game(b))
    studio(b)
    print('Completed '+name,flush=True)
manifest=OUT/'roster.json'
old=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
old=[entry for entry in old if entry['id'] not in NAMES]
manifest.write_text(json.dumps(old+reports,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pokemon-roster.blend'))
result={'models':reports,'project':bpy.data.filepath,'preview_folder':str(OUT/'previews')}
