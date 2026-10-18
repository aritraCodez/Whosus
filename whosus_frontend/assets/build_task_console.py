"""Original interactive task console. blender --background --python assets/build_task_console.py"""
import bpy
import math
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0, glow=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .35
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = glow
    return mat

body = material('Console graphite', (.055,.12,.15), .4)
rim = material('Brushed alloy', (.35,.49,.5), .65)
screen = material('Screen glass', (.015,.06,.07), .15)
light = material('Status mint', (.18,.85,.65), .1, 1)
key = material('Ivory keys', (.82,.85,.73))
amber = material('Safety amber', (.98,.64,.19), .1, .35)

def box(name, position, size, mat, bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Soft edges', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    obj.modifiers.new('Normals', 'WEIGHTED_NORMAL')
    return obj

box('Pedestal', (0,0,.43), (1.04,.7,.86), body, .09)
box('Foot', (0,0,.06), (1.12,.77,.12), rim)
box('Screen frame', (0,.02,.94), (1.12,.77,.18), rim, .06)
box('Display', (0,.06,1.04), (.9,.48,.04), screen)
for i in range(5):
    box('Signal bar', (-.32+i*.16,.08,1.07), (.07,.08+i*.045,.025), light, .01)
for i in range(4):
    box('Control key', (-.3+i*.2,-.27,1.04), (.12,.09,.05), key, .015)
for i in range(3):
    box('Vent rib', (0,-.36,.3+i*.1), (.65,.025,.035), rim, .008)
box('Status strip', (0,-.36,.75), (.7,.025,.05), light, .01)
for x in (-.43,.43):
    box('Safety corner', (x,-.36,.63), (.06,.03,.18), amber, .012)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.1, depth=.06, location=(.38,-.25,1.07))
bpy.context.object.name = 'Rotary dial'
bpy.context.object.data.materials.append(amber)
# Bake and join the static parts so each station needs only one draw per material.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
bpy.context.object.name = 'Task console'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'task-console.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'task-console.glb'), export_format='GLB', export_apply=True)
print('Exported interactive task console')
