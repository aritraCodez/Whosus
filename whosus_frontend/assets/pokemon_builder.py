"""Shared mesh authoring helpers for the referenced Pokémon roster.

Run build_pokemon_roster.py through the local Blender MCP bridge.
Front is Blender -Y, which exports to game +Z. All geometry is locally authored.
"""
import bpy
import math
import random
from mathutils import Vector
from pathlib import Path

ROOT=Path('D:/my project/whosus')
OUT=ROOT/'pokemon'
ASSETS=ROOT/'whosus_frontend/public/models/pokemon'
OUT.mkdir(exist_ok=True)
ASSETS.mkdir(parents=True,exist_ok=True)
(OUT/'previews').mkdir(exist_ok=True)

def color(hex):
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)

def mat(name,tint,rough=.55,emit=0):
    m=bpy.data.materials.new('PK | '+name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=color(tint)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Specular IOR Level'].default_value=.3
    p.inputs['Emission Color'].default_value=color(tint)
    p.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=color(tint)
    return m

palette={name:mat(name,tint,rough) for name,tint,rough in [
    ('ink','25232C',.32),('white','FFF9E9',.4),('cream','F6E3B2',.73),
    ('eevee','B67D47',.72),('eevee_dark','75472D',.7),('ear_dark','3F2B21',.75),
    ('gold','F5CE43',.55),('cheek','DD5B44',.6),('brown','865033',.75),
    ('rowlet','C49A72',.72),('rowlet_wing','AC805A',.7),('leaf','319E72',.65),
    ('orange','E8A15B',.55),('mint','C3DCA3',.7),('cat_green','67A74D',.65),
    ('cat_dark','46883D',.7),('pink_iris','BC5C7F',.3),('nose_pink','BD687A',.6),
    ('piplup_blue','468FBA',.55),('piplup_dark','286791',.6),('piplup_light','95CDD7',.65),
    ('blue_iris','284575',.25),('beak','F1C844',.55),('pink','EFB6C8',.67),
    ('pink_deep','D18BA6',.65),('teal_iris','1B849A',.3),('togepi','FFF0BD',.65),
    ('shell_white','EEEDE3',.7),('red','D46E56',.58),('blue','68B5D5',.55),
    ('squirtle','78BDCE',.57),('belly','E7D5AA',.7),('belly_line','AA916B',.8),
    ('shell','9C674A',.7),('shell_line','684B3C',.8),('purple_iris','793A59',.35),
    ('charizard','DE8E43',.6),('wing','358C99',.68),('wing_dark','226B7E',.68),
    ('char_belly','F0D797',.7),('flame','F89636',.5),('flame_core','FFE186',.45),
]}
palette['flame'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.9
palette['flame_core'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1.6

class Builder:
    def __init__(self,name):
        self.name=name
        self.scene=bpy.data.scenes.new('Pokemon | '+name.title())
        bpy.context.window.scene=self.scene
        self.coll=bpy.data.collections.new(name+' | Editable character')
        self.scene.collection.children.link(self.coll)
        self.root=bpy.data.objects.new(name+'_Root',None)
        self.coll.objects.link(self.root)
        self.root['pokemon']=name
        self.root['reference']='https://www.pokemon.com/us/pokedex/'+name
        self.count=0
    def group(self,part,pos=(0,0,0)):
        obj=bpy.data.objects.new(self.name+'_'+part,None)
        self.coll.objects.link(obj)
        obj.parent=self.root
        obj.location=pos
        obj['part']=part
        return obj
    def put(self,obj,name,material,parent=None,smooth=True):
        self.count+=1
        obj.name=self.name+'_'+name+'_'+str(self.count).zfill(2)
        for c in list(obj.users_collection):c.objects.unlink(obj)
        self.coll.objects.link(obj)
        parent=parent or self.root
        world=obj.location.copy()
        obj.parent=parent
        obj.location=world-parent.location
        if material:
            obj.data.materials.append(palette[material] if isinstance(material,str) else material)
        if obj.type=='MESH':
            for p in obj.data.polygons:p.use_smooth=smooth
            obj.data.name=obj.name+'_Mesh'
        return obj
    def sphere(self,name,pos,scale,material,parent=None,segments=24,rings=14):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=pos)
        obj=self.put(bpy.context.object,name,material,parent)
        for v in obj.data.vertices:
            v.co.x*=scale[0];v.co.y*=scale[1];v.co.z*=scale[2]
        return obj
    def mesh(self,name,verts,faces,material,parent=None,smooth=True):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        self.coll.objects.link(obj)
        self.put(obj,name,material,parent,smooth)
        # Input mesh vertices are world coordinates; move them into the chosen pivot.
        for v in mesh.vertices:v.co-=obj.parent.location
        obj.location=(0,0,0)
        return obj
    def tube(self,name,points,radius,material,parent=None,cyclic=False):
        curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
        curve.resolution_u=10;curve.bevel_depth=radius;curve.bevel_resolution=2
        curve.use_fill_caps=True
        sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
        sp.use_cyclic_u=cyclic
        for point,co in zip(sp.bezier_points,points):
            point.co=co;point.handle_left_type=point.handle_right_type='AUTO'
        obj=bpy.data.objects.new(name,curve);self.coll.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
        obj=self.put(bpy.context.object,name,material,parent)
        for v in obj.data.vertices:v.co-=obj.parent.location
        obj.location=(0,0,0)
        return obj
    def spindle(self,name,points,radii,material,parent=None,sides=12,tip_material=None):
        verts=[];faces=[]
        for j,point in enumerate(points):
            tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
            tangent.normalize()
            u=tangent.cross(Vector((0,-1,0)))
            if u.length<.01:u=tangent.cross(Vector((1,0,0)))
            u.normalize();v=tangent.cross(u).normalized()
            rad=radii[j]
            rx,ry=(rad,rad) if isinstance(rad,(int,float)) else rad
            for i in range(sides):
                a=math.tau*i/sides
                verts.append(tuple(Vector(point)+u*rx*math.cos(a)+v*ry*math.sin(a)))
        faces.append(tuple(reversed(range(sides))))
        for j in range(len(points)-1):
            for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
        faces.append(tuple((len(points)-1)*sides+i for i in range(sides)))
        obj=self.mesh(name,verts,faces,material,parent)
        if tip_material:
            obj.data.materials.append(palette[tip_material])
            for p in obj.data.polygons:
                if p.index>1+(len(points)-3)*sides:p.material_index=1
        return obj
    def leaf(self,name,base,tip,width,depth,material,parent=None,inner=None,tip_material=None):
        base=Vector(base);tip=Vector(tip)
        times=[0,.2,.52,.76,.89,1]
        widths=[.25,.78,1,.72,.42,.015]
        points=[tuple(base.lerp(tip,t)) for t in times]
        radii=[(width*w,depth*math.sin(math.pi*(t*.9+.05))) for t,w in zip(times,widths)]
        obj=self.spindle(name,points,radii,material,parent,12,tip_material)
        if inner:
            b=base.lerp(tip,.15)+Vector((0,-depth*.92,0))
            t=base.lerp(tip,.9)+Vector((0,-depth*.5,0))
            self.leaf(name+'_inner',b,t,width*.59,depth*.15,inner,parent)
        return obj
    def poly(self,name,outline,y,thickness,material,parent=None,bevel=0):
        n=len(outline)
        verts=[(x,y-thickness/2,z) for x,z in outline]+[(x,y+thickness/2,z) for x,z in outline]
        faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        obj=self.mesh(name,verts,faces,material,parent,False)
        if bevel:
            mod=obj.modifiers.new('Soft shape edges','BEVEL');mod.width=bevel;mod.segments=2
        return obj
    def eye(self,x,y,z,sx,sz,parent,iris='ink',white=False):
        if white:self.sphere('Eye_white',(x,y,z),(sx*1.22,.042,sz*1.12),'white',parent,20,12)
        self.sphere('Eye_iris',(x,y-.032 if white else y,z),(sx,.038,sz),iris,parent,20,12)
        if iris!='ink':self.sphere('Eye_pupil',(x,y-.065,z+.005),(sx*.48,.023,sz*.8),'ink',parent,16,10)
        self.sphere('Eye_highlight',(x-sx*.23,y-.09,z+sz*.47),(sx*.27,.014,sz*.27),'white',parent,12,8)
    def smile(self,y,z,width,parent,material='ink'):
        self.tube('Friendly_mouth',[(-width,y,z+.015),(0,y-.012,z-.025),(width,y,z+.015)],.012,material,parent)
    def toe_feet(self,x,y,z,material,parent):
        self.sphere('Foot',(x,y,z),(.17,.23,.085),material,parent,20,10)
        for dx in [-.08,0,.08]:
            self.tube('Toe_line',[(x+dx,y-.20,z+.025),(x+dx,y-.14,z+.073)],.006,'belly_line',parent)
    def finish(self,height=1.55):
        bpy.context.view_layer.update()
        tops=[];bottoms=[]
        for obj in self.coll.objects:
            if obj.type=='MESH':
                for v in obj.data.vertices:
                    tops.append((obj.matrix_world@v.co).z)
        factor=height/(max(tops)-min(tops))
        self.root.scale=(factor,)*3
        self.root.location.z=-min(tops)*factor
        self.root['game_height']=height
        self.scene['Model']=self.name.title()
        self.scene['Reference']=self.root['reference']
        return self
