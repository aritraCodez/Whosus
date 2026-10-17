"""Reproducible original WhoSus? models. Run with Blender --background --python."""
import bpy
import math
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / 'public' / 'models'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=.38; bs.inputs['Metallic'].default_value=metal
    return m
shell=material('Shell',(.96,.61,.16),.1)
dark=material('Graphite',(.045,.085,.11),.25)
ivory=material('Porcelain',(.91,.92,.83))
mint=material('Mint',(.30,.80,.61))
eye=material('EyeLight',(.65,1,.91))
bs=eye.node_tree.nodes.get('Principled BSDF'); bs.inputs['Emission Color'].default_value=(.4,1,.7,1); bs.inputs['Emission Strength'].default_value=1.5

def cube(name,loc,scale,mat,bevel=.1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    mod=o.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc); o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

cube('Torso',(0,0,.68),(.57,.4,.52),shell,.14)
cube('Head',(0,-.015,1.2),(.83,.56,.58),shell,.16)
cube('Face',(0,-.301,1.22),(.66,.045,.32),dark,.11)
for x in [-.17,.17]: sphere('Eye',(x,-.334,1.23),(.065,.025,.085),eye)
cube('Badge',(0,-.215,.7),(.18,.04,.13),ivory,.025)
for x,n in [(-.39,'ArmL'),(.39,'ArmR')]: cube(n,(x,0,.67),(.16,.22,.40),ivory,.07)
for x,n in [(-.18,'FootL'),(.18,'FootR')]: cube(n,(x,-.045,.20),(.24,.38,.25),dark,.07)
cube('BackBattery',(0,.24,.73),(.33,.15,.34),dark,.055)
bpy.ops.export_scene.gltf(filepath=str(OUT/'pip.glb'),export_format='GLB',export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pip.blend'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
cube('ConsoleBase',(0,0,.35),(1,.65,.7),dark,.12)
o=cube('ConsoleScreen',(0,-.08,.78),(.86,.57,.10),mint,.05); o.rotation_euler[0]=math.radians(15)
for x in [-.28,0,.28]:cube('Key',(x,-.30,.73),(.12,.08,.04),ivory,.02)
bpy.ops.export_scene.gltf(filepath=str(OUT/'console.glb'),export_format='GLB',export_apply=True)
print('WhoSus? original models exported to',OUT)
