"""Low ground-cover details, kept below walking height or outside playable floors."""
import bpy
import math
import random


def add_forest_detail(terrain):
    rng=random.Random(217)
    earth=bpy.data.materials['Forest | Peat rock']
    grass=bpy.data.materials['Forest | Moss ground']
    bark=bpy.data.materials['Forest | Warm bark']
    light=bpy.data.materials['Forest | Firefly seeds']
    leaf=bpy.data.materials['Forest | Canopy 1']

    def add(obj,name,mat):
        obj.name=name
        for coll in list(obj.users_collection): coll.objects.unlink(obj)
        terrain.objects.link(obj)
        obj.data.materials.append(mat)
        return obj

    # A forest floor below the raised trails removes empty voids without adding walkable area.
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=25,depth=.4,location=(0,0,-1.1))
    add(bpy.context.object,'Forest | Sunken woodland floor',earth)

    verts,faces=[],[]
    centers=[(0,0),(-10,0),(0,-10),(10,0),(0,10),(-10,-10),(10,-10),(-10,10),(10,10)]
    for cx,cz in centers:
        for corner_x,corner_z in [(-1,-1),(-1,1),(1,-1),(1,1)]:
            for sprig in range(26):
                x=cx+corner_x*rng.uniform(2.45,3.65)
                z=cz+corner_z*rng.uniform(2.45,3.65)
                for blade in range(3):
                    angle=rng.random()*math.tau
                    width=rng.uniform(.035,.065)
                    height=rng.uniform(.07,.17)
                    dx,dy=math.cos(angle),math.sin(angle)
                    i=len(verts)
                    verts.extend([(x-dy*width,-z+dx*width,.015),
                                  (x+dy*width,-z-dx*width,.015),
                                  (x+dx*.07,-z+dy*.07,height)])
                    faces.append((i,i+1,i+2))
    mesh=bpy.data.meshes.new('Forest | Low fern ground cover')
    mesh.from_pydata(verts,[],faces)
    obj=bpy.data.objects.new('Forest | Low fern ground cover',mesh)
    terrain.objects.link(obj)
    mesh.materials.append(leaf)

    # Trees occupy the blocked gaps between clearings, leaving all corridors open.
    for x,z in [(-5,-4),(5,-4),(-5,4),(5,4)]:
        bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.22,radius2=.12,depth=1.7,location=(x,-z,.15))
        add(bpy.context.object,'Forest | Gap tree trunk',bark)
        for height,radius in [(1.05,.73),(1.5,.55),(1.85,.35)]:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,height))
            obj=add(bpy.context.object,'Forest | Gap canopy',leaf)
            obj.scale=(radius,radius,.65)
            for p in obj.data.polygons: p.use_smooth=True
        for dx,dz in [(-.5,.6),(.4,.7)]:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x+dx,-z-dz,-.35))
            obj=add(bpy.context.object,'Forest | Deep moss cushion',grass)
            obj.scale=(.35,.4,.25)

    # Tiny luminous mushrooms at the edge of each clearing can be walked over.
    for cx,cz in centers:
        for k in range(3):
            x,z=cx-3.2+k*.19,cz+2.65+k*.07
            bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=.025,radius2=.02,depth=.1,location=(x,-z,.045))
            add(bpy.context.object,'Forest | Mushroom stem',bark)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=(x,-z,.1))
            obj=add(bpy.context.object,'Forest | Glow mushroom cap',light)
            obj.scale=(.085,.085,.035)
