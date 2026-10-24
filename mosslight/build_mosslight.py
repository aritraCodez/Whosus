"""Create Mosslight in a new Blender scene. Run through the local MCP bridge."""
import bpy
import math
import random
from mathutils import Vector
from pathlib import Path

OUT = Path('D:/my project/whosus/mosslight')
OUT.mkdir(exist_ok=True)
rng = random.Random(61024)

if 'Mosslight | Studio' in bpy.data.scenes:
    raise RuntimeError('Mosslight already exists; edit the existing scene rather than duplicating it.')
scene = bpy.data.scenes.new('Mosslight | Studio')
bpy.context.window.scene = scene
scene['Character'] = 'Mosslight'
scene['Design'] = 'An original low, wide woodland stone-creature with a living moss garden and amber lantern crystals.'
scene['Notes'] = 'Face integrated into the front pebble. Four separate load-bearing feet. No external texture dependencies.'

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

body_coll = collection('01 | Body and four feet')
face_coll = collection('02 | Integrated face')
moss_coll = collection('03 | Moss cushions and sprigs')
crystal_coll = collection('04 | Amber crystals and light cores')
detail_coll = collection('05 | Pebble plates and glow seeds')
studio_coll = collection('06 | Studio camera and lights')

root = bpy.data.objects.new('Mosslight | Character root', None)
body_coll.objects.link(root)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = .35
root['Purpose'] = 'Move or scale this root to transform the entire character.'

def linear_hex(value):
    value = value.lstrip('#')
    rgb = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)

def material(name, color, roughness=.5, metallic=0, emission=None, strength=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = linear_hex(color)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    m.diffuse_color = linear_hex(color)
    if emission:
        p.inputs['Emission Color'].default_value = linear_hex(emission)
        p.inputs['Emission Strength'].default_value = strength
    return m

def stone_material(name, colors, scale=4.5, bump_strength=.13):
    m = material(name, colors[0], .8)
    tree = m.node_tree
    p = tree.nodes.get('Principled BSDF')
    p.inputs['Specular IOR Level'].default_value = .28
    p.inputs['Subsurface Weight'].default_value = .025
    p.inputs['Subsurface Radius'].default_value = (.35, .6, .25)
    coord = tree.nodes.new('ShaderNodeTexCoord')
    coord.location = (-850, 70)
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.name = 'Soft mineral color variation'
    noise.location = (-640, 120)
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3
    noise.inputs['Roughness'].default_value = .65
    tree.links.new(coord.outputs['Generated'], noise.inputs['Vector'])
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    ramp.location = (-400, 120)
    ramp.color_ramp.elements[0].position = .18
    ramp.color_ramp.elements[0].color = linear_hex(colors[0])
    ramp.color_ramp.elements[1].position = .8
    ramp.color_ramp.elements[1].color = linear_hex(colors[1])
    tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
    tree.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    grain = tree.nodes.new('ShaderNodeTexNoise')
    grain.location = (-640, -170)
    grain.inputs['Scale'].default_value = 112
    grain.inputs['Detail'].default_value = 2
    tree.links.new(coord.outputs['Generated'], grain.inputs['Vector'])
    bump = tree.nodes.new('ShaderNodeBump')
    bump.location = (-180, -100)
    bump.inputs['Strength'].default_value = bump_strength
    bump.inputs['Distance'].default_value = .027
    tree.links.new(grain.outputs['Fac'], bump.inputs['Height'])
    tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    p.location = (40, 80)
    return m

skin = stone_material('Skin | Deep forest jade, matte mineral', ['244A40', '3F6C55'])
face_skin = stone_material('Skin | Soft front pebble', ['315749', '4E7861'], 3.1, .09)
foot_mat = stone_material('Skin | Footstone green', ['284D43', '496B56'], 4, .12)
plates = [stone_material('Plate | ' + label, colors, 3.2, .12) for label, colors in [
    ('sage shale', ['527567','708D75']),
    ('lichen slate', ['395C50','60836A']),
    ('warm weathered edge', ['68745B','8E9671']),
]]
socket_mat = material('Face | Deep green eye recess', '142D28', .83)
eye_mat = material('Face | Polished dark obsidian', '091C19', .2)
eye_mat.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value = .28
mouth_mat = material('Face | Quiet mouth line', '18342C', .92)
seam_mat = material('Details | Shaded mineral seams', '24483E', .85)

moss_mats = []
for name, color in [('fern velvet','64802E'),('new lime tips','92AC49'),('deep cushion','47652E'),('olive gold','7F923B')]:
    m = material('Moss | ' + name, color, .92)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Sheen Weight'].default_value = .4
    p.inputs['Sheen Roughness'].default_value = .7
    p.inputs['Subsurface Weight'].default_value = .05
    n = m.node_tree.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 135
    n.inputs['Detail'].default_value = 2
    bump = m.node_tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .23
    bump.inputs['Distance'].default_value = .035
    m.node_tree.links.new(n.outputs['Fac'], bump.inputs['Height'])
    m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    moss_mats.append(m)

crystal_mats = []
for label, tint, rough in [('clear honey','F2BB60',.12),('gold facets','E7A343',.155),('pale facets','FFD487',.1)]:
    m = material('Crystal | ' + label, tint, rough, emission='F1AC37', strength=.045)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Transmission Weight'].default_value = .88
    p.inputs['IOR'].default_value = 1.46
    p.inputs['Coat Weight'].default_value = .23
    p.inputs['Coat Roughness'].default_value = .12
    volume = m.node_tree.nodes.new('ShaderNodeVolumeAbsorption')
    volume.inputs['Color'].default_value = linear_hex('E7A54C')
    volume.inputs['Density'].default_value = .38
    m.node_tree.links.new(volume.outputs['Volume'], m.node_tree.nodes.get('Material Output').inputs['Volume'])
    crystal_mats.append(m)
core_mat = material('Crystal | Gentle internal amber light', 'F8C577', .28, emission='FFD078', strength=1.5)
core_mat.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .35
fleck_mat = material('Crystal | Suspended golden flecks', 'FFE7AB', .26, emission='FFD580', strength=2)
seed_mat = material('Glow seeds | Warm chartreuse light', 'DDE590', .31, emission='F1E99D', strength=1.35)
ground_mat = material('Studio | Soft celadon ground', 'B7C7B7', .92)

def put(obj, name, coll, mat=None, parent=True):
    obj.name = name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    coll.objects.link(obj)
    if obj.data and hasattr(obj.data, 'name'):
        obj.data.name = name + ' | mesh' if obj.type == 'MESH' else name + ' | data'
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = root
    return obj

def mesh_object(name, verts, faces, coll, mats, smooth=False):
    mesh = bpy.data.meshes.new(name + ' | mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.materials.clear()
    for m in mats:
        mesh.materials.append(m)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    obj.parent = root
    for p in mesh.polygons:
        p.use_smooth = smooth
    return obj

def apply_scale(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def pebble(name, location, scale, mat, coll, subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=location)
    obj = put(bpy.context.object, name, coll, mat)
    obj.scale = scale
    apply_scale(obj)
    for v in obj.data.vertices:
        v.co *= 1 + .025 * math.sin(v.co.x * 17 + v.co.y * 8 + v.co.z * 13)
    for p in obj.data.polygons:
        p.use_smooth = True
    mod = obj.modifiers.new('Soft weathered corners', 'SUBSURF')
    mod.levels = 1
    mod.render_levels = 1
    return obj

def uv_shape(name, location, scale, mat, coll, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=location)
    obj = put(bpy.context.object, name, coll, mat)
    obj.scale = scale
    apply_scale(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def line_mesh(name, points, radius, mat, coll):
    curve = bpy.data.curves.new(name + ' | path', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for b, co in zip(spline.bezier_points, points):
        b.co = co
        b.handle_left_type = 'AUTO'
        b.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    coll.objects.link(obj)
    obj.parent = root
    curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object

# A rounded superellipsoid gives the torso a broad weathered-stone silhouette.
P = 2.45
E = 2 / P
RX, RY, RZ, CZ = 2.22, 1.58, 1.17, 1.64
def sp(v, power):
    return math.copysign(abs(v) ** power, v)

def warp(x, y, z):
    return .025 * math.sin(2.8*x + 1.4*y) * math.sin(2.2*y - .7*z) + .015 * math.cos(4*x - 2*y)

def top_z(x, y):
    q = max(.001, 1 - abs(x / RX) ** P - abs(y / RY) ** P)
    z = CZ + RZ * q ** (1/P)
    return z + warp(x, y, z)

def surface_normal(x, y):
    eps = .005
    return Vector((-(top_z(x+eps,y)-top_z(x-eps,y))/(2*eps), -(top_z(x,y+eps)-top_z(x,y-eps))/(2*eps), 1)).normalized()

verts = [(0, 0, CZ - RZ)]
faces = []
segments, rings = 64, 32
for j in range(1, rings):
    lat = -math.pi/2 + math.pi*j/rings
    for i in range(segments):
        lon = 2*math.pi*i/segments
        x = RX * sp(math.cos(lat),E) * sp(math.cos(lon),E)
        y = RY * sp(math.cos(lat),E) * sp(math.sin(lon),E)
        z = CZ + RZ * sp(math.sin(lat),E)
        verts.append((x,y,z+warp(x,y,z)))
top = len(verts)
verts.append((0,0,CZ+RZ+warp(0,0,CZ+RZ)))
for i in range(segments):
    nxt=(i+1)%segments
    faces.append((0,1+nxt,1+i))
for j in range(rings-2):
    for i in range(segments):
        nxt=(i+1)%segments
        a=1+j*segments+i
        b=1+j*segments+nxt
        faces.append((a,b,b+segments,a+segments))
for i in range(segments):
    faces.append((1+(rings-2)*segments+i,1+(rings-2)*segments+(i+1)%segments,top))
body = mesh_object('Body | Broad river-stone torso', verts, faces, body_coll, [skin], True)
body['Design role'] = 'Low, wide body; front face is integrated without a neck, muzzle, ears, or tail.'
subd = body.modifiers.new('Stone surface smoothing', 'SUBSURF')
subd.levels=1
subd.render_levels=1

# Four sturdy rounded wedge feet, with flat-ish soles and no animal claws.
for side, x in [('L',-1.52),('R',1.52)]:
    for end, y in [('Front',-.96),('Back',.98)]:
        foot = uv_shape('Foot | '+side+' '+end, (x,y,.41), (.51,.58,.48), foot_mat, body_coll,32,20)
        for v in foot.data.vertices:
            height = (v.co.z + .48)/.96
            taper = 1.08 - .22 * height
            v.co.x *= taper
            v.co.y *= taper
            v.co.z = max(v.co.z, -.365)
        foot.rotation_euler[2] = math.radians(-8 if x<0 else 8)
        foot['Limb'] = side + ' ' + end + '; separate mesh'
        if end == 'Front':
            for k in [-1,1]:
                line_mesh('Foot crease | '+side+' '+str(k), [(x+k*.145, y-.535,.24),(x+k*.15,y-.55,.31),(x+k*.15,y-.52,.38)], .011,seam_mat,detail_coll)

# A small embedded facial stone: quiet eyes and an almost horizontal mouth.
head = pebble('Head | Embedded front pebble', (0,-1.43,1.51), (1.02,.36,.65), face_skin, face_coll,3)
for side,x in [('L',-.43),('R',.43)]:
    eye_y = -1.748
    socket = uv_shape('Eye socket | '+side,(x,eye_y,1.61),(.158,.047,.178),socket_mat,face_coll)
    eye = uv_shape('Eye | '+side+' obsidian',(x,eye_y-.035,1.61),(.108,.059,.13),eye_mat,face_coll)
    socket.rotation_euler[2] = math.radians(5 if x<0 else -5)
    eye.rotation_euler[2] = socket.rotation_euler[2]
line_mesh('Mouth | Small neutral seam',[(-.155,-1.748,1.302),(0,-1.767,1.293),(.155,-1.748,1.302)],.017,mouth_mat,face_coll)

# Pebble plates lie against the surface, asymmetrically placed.
def surface_plate(name,x,y,size,mat,angle=0):
    z=top_z(x,y)
    normal=surface_normal(x,y)
    obj=pebble(name,Vector((x,y,z))+normal*.035,size,mat,detail_coll,2)
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=normal.to_track_quat('Z','Y')
    return obj

surface_plate('Plate | Right shoulder broad',1.73,-.48,(.48,.38,.105),plates[0])
surface_plate('Plate | Right shoulder small',1.94,.12,(.29,.28,.085),plates[1])
surface_plate('Plate | Rear shale',.45,1.29,(.46,.29,.10),plates[2])
surface_plate('Plate | Left front chip',-1.57,-.91,(.25,.26,.075),plates[0])
surface_plate('Plate | Front crown chip',.27,-1.09,(.31,.21,.065),plates[1])

# Moss: continuous irregular cushions following the torso, with combined sprig meshes.
patches = [
    ('West shoulder',-1.05,.12,.83,.91,550),
    ('Rear garden',.62,.74,.86,.57,400),
    ('East fringe',1.39,-.59,.38,.42,160),
    ('Front moss island',-.67,-1.05,.29,.23,75),
]

def moss_patch(label,cx,cy,ax,ay,count):
    def boundary(a):
        return 1 + .075*math.sin(3*a+.5) + .05*math.cos(7*a-.4)
    def point(r,a):
        k=boundary(a)
        x=cx+ax*r*k*math.cos(a)
        y=cy+ay*r*k*math.sin(a)
        z=top_z(x,y)+.024+.09*(1-r*r)
        return Vector((x,y,z))
    pv=[tuple(point(0,0))]
    pf=[]
    nring,nseg=7,56
    for j in range(1,nring+1):
        for i in range(nseg):
            pv.append(tuple(point(j/nring,2*math.pi*i/nseg)))
    for i in range(nseg):
        pf.append((0,1+i,1+(i+1)%nseg))
    for j in range(nring-1):
        for i in range(nseg):
            a=1+j*nseg+i
            b=1+j*nseg+(i+1)%nseg
            pf.append((a,a+nseg,b+nseg,b))
    patch=mesh_object('Moss cushion | '+label,pv,pf,moss_coll,[moss_mats[0],moss_mats[2]],True)
    for poly in patch.data.polygons:
        poly.material_index=0 if rng.random()>.2 else 1
    solid=patch.modifiers.new('Soft moss hem','SOLIDIFY')
    solid.thickness=.035
    bevel=patch.modifiers.new('Cushion smoothing','SUBSURF')
    bevel.levels=1
    bevel.render_levels=1
    sv,sf,si=[],[],[]
    for k in range(count):
        a=rng.random()*2*math.pi
        r=math.sqrt(rng.random())*.99
        base=point(r,a)
        normal=surface_normal(base.x,base.y)
        tangent=normal.cross(Vector((0,1,0))).normalized()
        bitangent=normal.cross(tangent).normalized()
        for leaf in range(rng.randint(3,4)):
            theta=rng.random()*math.tau
            outward=tangent*math.cos(theta)+bitangent*math.sin(theta)
            cross=normal.cross(outward).normalized()
            length=rng.uniform(.045,.115)
            width=rng.uniform(.012,.025)
            start=base+outward*.008
            middle=start+normal*length*.58+outward*length*.2
            tip=start+normal*length*.85+outward*length*.49
            index=len(sv)
            sv.extend([tuple(start),tuple(middle-cross*width),tuple(middle+normal*.009),tuple(middle+cross*width),tuple(tip)])
            sf.extend([(index,index+1,index+2),(index,index+2,index+3),(index+1,index+4,index+2),(index+2,index+4,index+3)])
            si.extend([rng.choices([0,1,2,3],[4,3,2,2])[0]]*4)
    sprigs=mesh_object('Moss sprigs | '+label,sv,sf,moss_coll,moss_mats,True)
    for poly,idx in zip(sprigs.data.polygons,si):
        poly.material_index=idx
    patch['Detail'] = 'Separate editable cushion. Sprigs are combined into one manageable mesh.'
    return patch

for info in patches:
    moss_patch(*info)

# Closed hexagonal amber prisms with uneven tips and smaller internal light cores.
def crystal_mesh(name,radius,height,coll,mats,seed=0):
    crng=random.Random(seed)
    cv,cf=[],[]
    widths=[crng.uniform(.88,1.08) for _ in range(6)]
    for z,scale in [(0,.72),(.17*height,1),(.72*height,.88)]:
        for i in range(6):
            a=i*math.tau/6+.13
            cv.append((radius*scale*widths[i]*math.cos(a),radius*scale*widths[i]*math.sin(a),z+(.02*height*math.sin(i*2.2) if z else 0)))
    cv.append((radius*.13,-radius*.17,height))
    cf.append(tuple(reversed(range(6))))
    for j in range(2):
        for i in range(6):
            cf.append((j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i))
    for i in range(6):
        cf.append((12+i,12+(i+1)%6,18))
    obj=mesh_object(name,cv,cf,coll,mats,False)
    for poly in obj.data.polygons:
        poly.material_index = (poly.index//2)%len(mats)
    return obj

crystals=[
    ('01 | Tall lantern',.64,.34,.34,1.45,(-.10,.16,-.13)),
    ('02 | West shard',.02,.64,.26,1.03,(.13,-.25,-.28)),
    ('03 | East shard',1.19,.54,.29,.98,(-.08,.39,.15)),
    ('04 | Front bud',.91,-.13,.21,.68,(.22,.28,.5)),
    ('05 | Rear bud',.58,1.05,.22,.76,(-.27,-.14,-.2)),
    ('06 | Solitary seed',-1.36,.44,.16,.59,(.05,-.31,.34)),
]
for i,(label,x,y,r,h,rotation) in enumerate(crystals):
    origin=Vector((x,y,top_z(x,y)-.04))
    shell=crystal_mesh('Amber | '+label,r,h,crystal_coll,crystal_mats,101+i)
    shell.location=origin
    shell.rotation_euler=rotation
    edge=shell.modifiers.new('Minute crystal edge glints','BEVEL')
    edge.width=.009
    edge.segments=1
    edge.affect='EDGES'
    shell['Material'] = 'Closed translucent amber shell, absorption volume, separate low-emission inner core.'
    core=crystal_mesh('Light core | '+label,r*.24,h*.63,crystal_coll,[core_mat],101+i)
    core.location=origin+shell.rotation_euler.to_matrix()@Vector((0,0,h*.12))
    core.rotation_euler=rotation
    for j in range(3):
        local=Vector((rng.uniform(-.32,.32)*r,rng.uniform(-.32,.32)*r,h*(.23+j*.16)))
        fleck=pebble('Amber inclusion | '+str(i+1)+'.'+str(j+1),origin+shell.rotation_euler.to_matrix()@local,(.014,.018,.028),fleck_mat,crystal_coll,1)

# Small warm bioluminescent seeds, clustered unevenly over the back.
spots=[(-1.68,-.18,.055),(-1.65,.08,.038),(-1.48,-.44,.041),(-.44,-.70,.066),(-.24,-.68,.036),(-.34,-.87,.038),(.05,1.26,.058),(-.23,1.21,.037),(1.58,.82,.052),(1.72,.62,.036)]
for i,(x,y,r) in enumerate(spots):
    normal=surface_normal(x,y)
    origin=Vector((x,y,top_z(x,y)))
    socket=uv_shape('Glow socket | '+str(i+1).zfill(2),origin+normal*.021,(r*1.4,r*1.4,r*.52),seam_mat,detail_coll,16,10)
    seed=uv_shape('Glow seed | '+str(i+1).zfill(2),origin+normal*.046,(r,r,r*.62),seed_mat,detail_coll,16,10)
    socket.rotation_mode=seed.rotation_mode='QUATERNION'
    socket.rotation_quaternion=seed.rotation_quaternion=normal.to_track_quat('Z','Y')

# Minimal seamless studio.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
ground=put(bpy.context.object,'Studio | Seamless ground',studio_coll,ground_mat,parent=False)
world=bpy.data.worlds.new('Studio | Celadon ambient')
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=linear_hex('D7E5DB')
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
scene.world=world

def area(name,position,power,size,color,target=(0,0,1.5)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=linear_hex(color)[:3]
    obj=bpy.data.objects.new(name,data)
    studio_coll.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Light | Large soft key',(-3.8,-4.5,7.5),1050,5,'FFF2D8')
area('Light | Cool face fill',(4,-4,4.6),700,4,'DDEFF0')
area('Light | Warm crystal rim',(2.8,4.2,6.5),1250,3.2,'FFE4B6')
area('Light | Left moss edge',(-4,2,3.7),500,3,'E6F1CE')

camera_data=bpy.data.cameras.new('Camera | Full-body three-quarter')
camera=bpy.data.objects.new('Camera | Full-body three-quarter',camera_data)
studio_coll.objects.link(camera)
camera.location=(7.3,-12.8,7.1)
target=Vector((0,0,1.92))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=7.7
camera_data.lens=58
camera_data.clip_end=250
scene.camera=camera

scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'
prefs.refresh_devices()
for device in prefs.devices:
    device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.max_bounces=10
scene.cycles.transmission_bounces=8
scene.cycles.transparent_max_bounces=8
scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.03
scene.render.resolution_x=1500
scene.render.resolution_y=1500
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
scene.render.film_transparent=False
scene.render.filepath=str(OUT/'mosslight_preview.png')
scene.view_settings.view_transform='AgX'
try:
    scene.view_settings.look='AgX - Medium High Contrast'
except TypeError:
    pass

# Very restrained glow, so the glass facets remain readable.
comp=bpy.data.node_groups.new('Mosslight | Gentle optical glow','CompositorNodeTree')
comp.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
rl=comp.nodes.new('CompositorNodeRLayers')
rl.scene=scene
glare=comp.nodes.new('CompositorNodeGlare')
glare.inputs['Type'].default_value='Fog Glow'
glare.inputs['Quality'].default_value='High'
glare.inputs['Threshold'].default_value=1.7
glare.inputs['Strength'].default_value=.09
glare.inputs['Size'].default_value=.25
glare.location=(240,0)
out=comp.nodes.new('NodeGroupOutput')
out.location=(480,0)
comp.links.new(rl.outputs['Image'],glare.inputs['Image'])
comp.links.new(glare.outputs['Image'],out.inputs['Image'])
scene.compositing_node_group=comp

# UVs for all character meshes make the procedural asset straightforward to bake.
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type=='MESH' and obj.parent==root:
        obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15192,island_margin=.02)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active=body

for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.overlay.show_overlays=False
            a.spaces.active.shading.type='MATERIAL'

readme=bpy.data.texts.new('Mosslight | Read me')
readme.write('Mosslight\nOriginal forest creature created procedurally in Blender.\n\nScene: Mosslight | Studio\nCollections 01-05 contain the character, parented to one root.\nCollection 06 contains the reusable studio. The original scene is retained.\n\nAll four feet, face features, moss cushions, sprig meshes, pebble plates,\ncrystal shells, and light cores are separately editable. UVs are included.\nMaterials are procedural and require no external images.\nSubdivisions are non-destructive. Crystals use closed six-sided meshes.\n\nPreview: Cycles, AgX, 1500 x 1500, orthographic three-quarter view.\nThis is a static game-prototype asset, without rig or baked game textures.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mosslight.blend'))
meshes=[o for o in scene.objects if o.type=='MESH' and o.parent==root]
result={
    'saved':bpy.data.filepath,
    'scene':scene.name,
    'character_meshes':len(meshes),
    'base_vertices':sum(len(o.data.vertices) for o in meshes),
    'base_polygons':sum(len(o.data.polygons) for o in meshes),
    'feet':[o.name for o in meshes if o.name.startswith('Foot |')],
    'crystals':[o.name for o in meshes if o.name.startswith('Amber |')],
    'materials':len({m.name for o in meshes for m in o.data.materials}),
    'render_path':scene.render.filepath,
}
