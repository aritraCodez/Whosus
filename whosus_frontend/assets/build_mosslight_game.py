"""Build the game assets through the running Blender MCP add-on.

Uses the existing Mosslight art scene without changing its meshes or materials.
The forest's visible paths follow the game's shared authoritative collision grid.
"""
import bpy
import math
import random
import json
from pathlib import Path
from mathutils import Vector

ROOT=Path('D:/my project/whosus')
OUT=ROOT/'whosus_frontend/public/models'
OUT.mkdir(parents=True,exist_ok=True)
rng=random.Random(924)
if 'Mosslight | Game assets' in bpy.data.scenes:
    raise RuntimeError('Open the original mosslight/mosslight.blend before rebuilding game assets; the current game asset scene is preserved.')
source=bpy.data.objects['Mosslight | Character root']
originals=[o for o in bpy.data.objects if o.parent==source and o.type=='MESH']
game=bpy.data.scenes.new('Mosslight | Game assets')
bpy.context.window.scene=game
game.unit_settings.system='METRIC'
game.unit_settings.scale_length=1
character=bpy.data.collections.new('Game | Playable Mosslight')
terrain=bpy.data.collections.new('Game | Mosslight forest map')
game.collection.children.link(character)
game.collection.children.link(terrain)

def rgba(value):
    rgb=[int(value[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)

def material(name,tint,rough=.8,vertex=False,emission=0,alpha=1):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    c=rgba(tint)
    p.inputs['Base Color'].default_value=c
    p.inputs['Roughness'].default_value=rough
    p.inputs['Alpha'].default_value=alpha
    p.inputs['Emission Color'].default_value=c
    p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*c[:3],alpha)
    if vertex:
        v=m.node_tree.nodes.new('ShaderNodeVertexColor')
        v.layer_name='Color'
        m.node_tree.links.new(v.outputs['Color'],p.inputs['Base Color'])
    return m

stone=material('Mosslight_Stone','FFFFFF',vertex=True)
moss=material('Mosslight_Moss','FFFFFF',vertex=True)
eyes=material('Mosslight_Obsidian','102621',.22)
amber=material('Mosslight_Amber','F4B753',.22,emission=.14,alpha=.86)
glow=material('Mosslight_Glow','F5D986',.4,emission=1.1)
team=material('Mosslight_Team','B2CF8C',.65)

groups={}
for src in originals:
    name=src.name
    if name.startswith(('Amber inclusion','Foot crease')):
        continue
    obj=src.copy()
    obj.data=src.data.copy()
    obj.modifiers.clear()
    obj.parent=None
    obj.matrix_world=src.matrix_world.copy()
    character.objects.link(obj)
    obj.name='Game copy | '+name
    # The art model is kept intact; only the copied game meshes are simplified.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    if len(obj.data.polygons)>400 and not name.startswith('Body |'):
        dec=obj.modifiers.new('Game mesh reduction','DECIMATE')
        dec.ratio=.28 if name.startswith('Moss sprigs') else .38
        bpy.ops.object.modifier_apply(modifier=dec.name)
    if name.startswith('Foot |'):
        key='Mosslight_Foot_'+name.split('|')[1].strip().replace(' ','_')
        mat=stone
    elif name.startswith('Moss '): key,mat='Mosslight_Moss',moss
    elif name.startswith('Amber |'): key,mat='Mosslight_Crystals',amber
    elif name.startswith(('Light core','Glow seed')): key,mat='Mosslight_Glow',glow
    elif name.startswith('Eye |'): key,mat='Mosslight_Eyes',eyes
    elif name.startswith('Plate |'): key,mat='Mosslight_Plating',team
    else: key,mat='Mosslight_Body',stone
    colors=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    oldmats=list(obj.data.materials)
    for poly in obj.data.polygons:
        old=oldmats[poly.material_index] if oldmats else None
        tint=old.diffuse_color[:] if old else rgba('41634E')
        for li in poly.loop_indices:
            pos=obj.data.vertices[obj.data.loops[li].vertex_index].co
            variation=.94+.06*math.sin(pos.x*8+pos.y*11+pos.z*13)
            colors.data[li].color=tuple(min(1,c*variation) for c in tint[:3])+(1,)
        poly.material_index=0
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    groups.setdefault(key,[]).append(obj)

for name,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    obj.data.name=name+'_Mesh'
    # Bake size into geometry, retaining foot origins for runtime gait animation.
    for v in obj.data.vertices: v.co*=.25
    obj.location*=.25
    obj['asset']='mosslight'
    obj['part']=name

def export_collection(coll,path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in coll.objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_animations=False,export_extras=True,export_yup=True,export_apply=True)

export_collection(character,OUT/'mosslight.glb')

# Map palette and modular nature forms. Tall scenery remains outside walkable bounds.
earth=material('Forest | Peat rock','33483D',.96)
grass=material('Forest | Moss ground','738C55',.98)
pathmat=material('Forest | Ochre trail','A9A278',.95)
rock=material('Forest | Weathered stone','587967',.9)
bark=material('Forest | Warm bark','65543B',.95)
leaves=[material('Forest | Canopy '+str(i),c,.94) for i,c in enumerate(['315C49','497958','608865'])]
water=material('Forest | Quiet teal water','285D58',.3)
mapamber=material('Forest | Amber lantern','E8AF54',.28,emission=.3)
light=material('Forest | Firefly seeds','E5E5A0',.45,emission=1.3)

def move_to(obj,name,mat):
    obj.name=name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    terrain.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def box(name,x,z,w,d,h,mat,y=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y-h/2))
    obj=move_to(bpy.context.object,name,mat)
    obj.scale=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return obj

def ico(name,x,z,y,scale,mat,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=(x,-z,y))
    obj=move_to(bpy.context.object,name,mat)
    obj.scale=scale
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def crystal(name,x,z,y,r,h):
    n=6
    v=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),0) for i in range(n)]
    v += [(r*.78*math.cos(i*math.tau/n),r*.78*math.sin(i*math.tau/n),h*.72) for i in range(n)]
    v += [(r*.15,-r*.1,h)]
    f=[tuple(reversed(range(n)))]
    f += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    f += [(i+n,(i+1)%n+n,12) for i in range(n)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(v,[],f)
    obj=bpy.data.objects.new(name,mesh)
    terrain.objects.link(obj)
    obj.location=(x,-z,y)
    mesh.materials.append(mapamber)
    return obj

floors=[(-4,4,-4,4),(-14,-6,-4,4),(-4,4,-14,-6),(6,14,-4,4),(-4,4,6,14),
    (-14,-6,-14,-6),(6,14,-14,-6),(-14,-6,6,14),(6,14,6,14),
    (-12,12,-1.6,1.6),(-1.6,1.6,-12,12),(-11.5,-8.5,-16,-4),(8.5,11.5,-16,-4),
    (-11.5,-8.5,4,16),(8.5,11.5,4,16),(-12,12,-11.5,-8.5),(-12,12,8.5,11.5)]
obstacles=[(-.9,.9,-.9,.9),(-12.5,-10.5,1.5,3),(10.5,12.5,1.5,3),(-3,-1.5,-12.5,-10.5),
    (1.5,3,10.5,12.5),(-.8,.8,-10.8,-9.2),(-12.5,-10.5,-8.5,-7),
    (10.5,12.5,-8.5,-7),(-12.5,-10.5,7,8.5),(10.5,12.5,7,8.5)]
labels=['Gathering Grove','Fern Sanctuary','Amber Heart','Echo Glade','Nectar Hollow',
    'Firefly Lookout','Spore Meadow','Rootworks','Moonwell']
for i,(a,b,c,d) in enumerate(floors):
    x,z=(a+b)/2,(c+d)/2
    box('Clearing | '+labels[i] if i<9 else 'Trail | '+str(i),x,z,b-a,d-c,.65,earth,y=-.04)
    box('Moss floor | '+str(i),x,z,b-a,d-c,.08,grass if i<9 else pathmat,y=-.005 if i<9 else -.018)
    if i<9:
        # Flat path inlays: decoration does not introduce unmodelled collisions.
        box('Path cross X | '+str(i),x,z,7.9,1.7,.018,pathmat,y=.004)
        box('Path cross Z | '+str(i),x,z,1.7,7.9,.018,pathmat,y=.005)
        for j in range(18):
            a1=rng.random()*math.tau
            r1=rng.uniform(2.7,3.65)
            # Low moss stones at the clearing perimeter, below foot height.
            ico('Moss edging',x+math.cos(a1)*r1,z+math.sin(a1)*r1,-.015,(.16,.22,.05),rock)

for i,(a,b,c,d) in enumerate(obstacles):
    x,z=(a+b)/2,(c+d)/2
    if i==0:
        ico('Meeting | Mosslight guardian stone',0,0,.45,(.87,.87,.60),rock,2)
        crystal('Meeting | Amber callstone',0,0,.92,.30,.75)
        continue
    box('Collision stone | '+str(i),x,z,b-a,d-c,.8,rock,y=.8)
    ico('Moss cap | '+str(i),x,z,.83,((b-a)*.50,(d-c)*.50,.12),grass,2)
    if i==5:
        crystal('Amber Heart | Main spire',x,z,.82,.53,2.1)
        crystal('Amber Heart | Side spire',x+.48,z,.82,.23,1.15)
    else:
        crystal('Landmark | '+str(i),x,z,.9,.22,.65+.12*(i%3))

# Deep pools make the non-walkable gaps readable.
for x,z in [(-5,-5),(5,-5),(-5,5),(5,5)]:
    box('Forest pool',x,z,1.8,1.8,.12,water,y=-.38)
for i in range(48):
    angle=i*math.tau/48
    radius=rng.uniform(19,23)
    x,z=math.cos(angle)*radius,math.sin(angle)*radius
    h=rng.uniform(2,4.5)
    bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.28,radius2=.16,depth=h,location=(x,-z,h/2-.5))
    move_to(bpy.context.object,'Tree | Trunk',bark)
    for level in range(3):
        ico('Tree | Soft canopy',x,z,h*.6+level*.7,(1.3-level*.22,1.3-level*.22,1.15),leaves[(i+level)%3],1)
    if i%3==0:
        ico('Lantern seed',x*.9,z*.9,.4,(.12,.12,.18),light,1)
for i in range(40):
    angle=rng.random()*math.tau
    radius=rng.uniform(17,20)
    ico('Outer forest rock',math.cos(angle)*radius,math.sin(angle)*radius,-.25,
        (rng.uniform(.6,1.5),rng.uniform(.6,1.5),rng.uniform(.5,1.2)),earth,1)

# Merge static map geometry by material for a small draw-call count.
exec((ROOT/'whosus_frontend/assets/mosslight_forest_detail.py').read_text(encoding='utf-8'))
add_forest_detail(terrain)
by_material={}
for obj in list(terrain.objects):
    by_material.setdefault(obj.data.materials[0].name,[]).append(obj)
for key,objects in by_material.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    bpy.context.object.name='Mosslight_Map_'+key.split('|')[-1].strip().replace(' ','_')

export_collection(terrain,OUT/'mosslight-map.glb')
terrain.hide_viewport=True
terrain.hide_render=True
bpy.ops.object.select_all(action='DESELECT')
for obj in character.objects: obj.select_set(True)
game['Notes']='Game-ready Mosslight and forest map. Terrain collection is hidden for avatar editing; unhide to inspect the map.'
game['Collision']='The visible clearing/path rectangles match FLOORS in game/world.py and world.ts. Obstacle stones match OBSTACLES.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mosslight-game.blend'))
result={
    'character':str(OUT/'mosslight.glb'),'map':str(OUT/'mosslight-map.glb'),
    'editable':str(OUT/'mosslight-game.blend'),
    'character_meshes':len(character.objects),'map_meshes':len(terrain.objects),
    'character_polygons':sum(len(o.data.polygons) for o in character.objects),
    'feet':[o.name for o in character.objects if 'Foot' in o.name],
}
(ROOT/'mosslight/game_assets.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
