"""Refinements after inspecting the first studio render."""
import bpy
from mathutils import Vector

def color(value):
    values=[int(value[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)

# Reduce grazing sheen and leaf size to make the moss soft and dense.
for name, tint in [('fern velvet','577A29'),('new lime tips','8BA53F'),('deep cushion','3C5B25'),('olive gold','748C33')]:
    m=bpy.data.materials['Moss | '+name]
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=color(tint)
    m.diffuse_color=color(tint)
    p.inputs['Sheen Weight'].default_value=.10
    p.inputs['Specular IOR Level'].default_value=.18
    p.inputs['Subsurface Weight'].default_value=.035
for obj in bpy.data.objects:
    if obj.name.startswith('Moss sprigs |'):
        for i in range(0,len(obj.data.vertices),5):
            base=obj.data.vertices[i].co.copy()
            for j in range(1,5):
                obj.data.vertices[i+j].co=base+(obj.data.vertices[i+j].co-base)*.77
        obj.data.update()

# Use lighter transmission tints, subtler cores, and smaller specular highlights.
for label,tint in [('clear honey','F8CE84'),('gold facets','F2BC66'),('pale facets','FFE0A3')]:
    m=bpy.data.materials['Crystal | '+label]
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=color(tint)
    m.diffuse_color=color(tint)
    p.inputs['Transmission Weight'].default_value=.96
    p.inputs['Specular IOR Level'].default_value=.33
    p.inputs['Coat Weight'].default_value=.07
    p.inputs['Roughness'].default_value=.14
    p.inputs['Emission Strength'].default_value=.025
p=bpy.data.materials['Crystal | Gentle internal amber light'].node_tree.nodes.get('Principled BSDF')
p.inputs['Emission Strength'].default_value=.85
p.inputs['Transmission Weight'].default_value=.65

# A small cluster of lichen freckles emphasizes the weathered stone surface.
# The existing geometry is otherwise kept unchanged.
scene=bpy.data.scenes['Mosslight | Studio']
scene.render.resolution_percentage=60
scene.cycles.samples=48
scene.render.filepath='D:/my project/whosus/mosslight/mosslight_refined.png'
bpy.ops.render.render(write_still=True)
result={'render':scene.render.filepath,'refined':['velvet moss','amber transmission','gentle inner cores']}
