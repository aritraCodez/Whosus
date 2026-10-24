"""Togepi, Squirtle, and Charizard."""

def build_togepi():
    b=Builder('togepi')
    head=b.group('head',(0,0,1.24))
    b.sphere('Rounded_star_head',(0,0,1.14),(.39,.27,.30),'togepi',head,32,20)
    for base,tip,radius in [((-.29,0,1.18),(-.49,0,1.48),.18),((-.17,.02,1.32),(-.21,.035,1.62),.16),
        ((.06,.02,1.35),(.17,.04,1.67),.19),((.29,0,1.25),(.49,0,1.52),.19),((0,.14,1.29),(-.05,.31,1.56),.16)]:
        mid=tuple(Vector(base).lerp(Vector(tip),.5))
        b.spindle('Crown_point',[base,mid,tip],[radius,radius*.62,.002],'togepi',head,16)
    for sign in [-1,1]:
        b.eye(sign*.155,-.262,1.25,.035,.072,head)
        arm=b.group('arm_l' if sign<0 else 'arm_r',(sign*.43,0,.91))
        b.leaf('Cream_arm',(sign*.42,-.015,.89),(sign*.72,-.05,1.09),.13,.075,'togepi',arm)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.24,0,.15))
        b.sphere('Cream_foot',(sign*.24,-.06,.075),(.17,.22,.075),'togepi',leg)
    b.poly('Happy_open_mouth',[(-.052,1.205),(.055,1.205),(.03,1.105),(-.02,1.10)],-.299,.025,'ear_dark',head,.012)
    b.sphere('Tongue',(0,-.318,1.123),(.028,.012,.022),'nose_pink',head,12,8)
    verts=[(0,0,.08)];faces=[];sides=48;rings=16
    for j in range(1,rings+1):
        lat=-math.pi/2+(math.pi/2+.65)*j/rings
        for i in range(sides):
            a=i*math.tau/sides
            z=.61+.53*math.sin(lat)
            if j==rings:z+=.065*math.cos(a*8)
            verts.append((.51*math.cos(lat)*math.cos(a),.38*math.cos(lat)*math.sin(a),z))
    for i in range(sides):faces.append((0,1+(i+1)%sides,1+i))
    for j in range(rings-1):
        for i in range(sides):
            a=1+j*sides+i;an=1+j*sides+(i+1)%sides
            faces.append((a,an,an+sides,a+sides))
    shell=b.mesh('Jagged_eggshell',verts,faces,'shell_white')
    solid=shell.modifiers.new('Eggshell thickness','SOLIDIFY');solid.thickness=.023
    def marking(label,points,tint):
        b.surface_patch(label,points,(0,0,.61),(.51,.38,.53),tint)
        cx=sum(x for x,z in points)/len(points);cz=sum(z for x,z in points)/len(points)
        inner=[(cx+(x-cx)*.56,cz+(z-cz)*.56) for x,z in points]
        patch=b.surface_patch(label+'_hollow',inner,(0,0,.61),(.51,.38,.53),'shell_white')
        for v in patch.data.vertices:v.co.y-=.003
    marking('Blue_triangle',[(-.07,.78),(.22,.62),(-.035,.44)],'blue')
    marking('Red_triangle',[(-.36,.80),(-.20,.88),(-.22,.64)],'red')
    marking('Red_diamond',[(.25,.84),(.37,.87),(.37,.73),(.25,.70)],'red')
    marking('Blue_lower_triangle',[(.17,.31),(.35,.47),(.37,.29)],'blue')
    marking('Red_lower_mark',[(-.36,.42),(-.25,.35),(-.29,.23),(-.40,.32)],'red')
    return b.finish(1.4)

def build_squirtle():
    b=Builder('squirtle')
    b.sphere('Blue_torso',(0,0,.66),(.37,.30,.44),'squirtle',segments=28,rings=18)
    b.sphere('Brown_shell',(0,.245,.67),(.475,.255,.51),'shell',segments=32,rings=20)
    rim=[(.47*math.cos(a),.16,.67+.50*math.sin(a)) for a in [i*math.tau/16 for i in range(16)]]
    b.tube('Ivory_shell_rim',rim,.047,'cream',cyclic=True)
    # Back shell hexagon and radial plates.
    back=[(.24*math.cos(a),.495,.69+.28*math.sin(a)) for a in [i*math.tau/6+math.pi/6 for i in range(6)]]
    b.tube('Shell_center_hexagon',back,.015,'shell_line',cyclic=True)
    for p in back:
        b.tube('Shell_radial_seam',[p,(p[0]*1.70,.39,.67+(p[2]-.67)*1.65)],.014,'shell_line')
    b.sphere('Cream_belly',(0,-.255,.65),(.335,.092,.415),'belly',segments=28,rings=18)
    for z in [.49,.72,.91]:
        half=.27 if z<.85 else .19
        b.tube('Belly_horizontal_seam',[(-half,-.31,z),(0,-.35,z-.025),(half,-.31,z)],.009,'belly_line')
    b.tube('Belly_vertical_seam',[(0,-.306,.29),(0,-.35,.59),(0,-.335,.96)],.009,'belly_line')
    head=b.group('head',(0,-.04,1.28))
    b.sphere('Turtle_head',(0,-.04,1.28),(.49,.37,.42),'squirtle',head,32,20)
    for sign in [-1,1]:
        b.eye(sign*.222,-.366,1.355,.079,.14,head,'purple_iris',white=True)
        b.sphere('Nostril',(sign*.078,-.413,1.22),(.014,.008,.010),'piplup_dark',head,12,8)
        arm=b.group('arm_l' if sign<0 else 'arm_r',(sign*.32,0,.90))
        b.leaf('Turtle_arm',(sign*.32,-.015,.87),(sign*.60,-.12,.62),.14,.12,'squirtle',arm)
        for j in range(3):
            b.leaf('Finger',(sign*(.51+j*.045),-.13,.69),(sign*(.56+j*.045),-.20,.59+j*.025),.04,.03,'squirtle',arm)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.28,.035,.36))
        b.sphere('Blue_haunch',(sign*.29,.035,.29),(.20,.22,.25),'squirtle',leg)
        b.sphere('Turtle_foot',(sign*.30,-.07,.11),(.20,.25,.11),'squirtle',leg)
        for dx in [-.1,0,.1]:
            b.leaf('Pointed_toe',(sign*.30+dx,-.23,.11),(sign*.30+dx,-.34,.065),.045,.025,'squirtle',leg)
    b.tube('Wide_turtle_smile',[(-.27,-.34,1.17),(-.13,-.405,1.12),(0,-.423,1.107),(.13,-.405,1.12),(.27,-.34,1.17)],.011,'piplup_dark',head)
    tail=b.group('tail',(.18,.39,.40))
    b.spindle('Curled_blue_tail',[(.13,.40,.43),(.39,.61,.32),(.67,.65,.36),(.83,.63,.54),(.80,.60,.73),(.62,.57,.78),(.53,.54,.65),(.61,.53,.56)],
        [.12,.16,.19,.20,.18,.15,.11,.015],'squirtle',tail,16)
    return b.finish(1.5)

def build_charizard():
    b=Builder('charizard')
    b.sphere('Dragon_torso',(0,.055,.88),(.48,.355,.66),'charizard',segments=32,rings=20)
    b.sphere('Cream_belly',(0,-.257,.79),(.35,.105,.50),'char_belly',segments=28,rings=18)
    b.spindle('Long_dragon_neck',[(0,.01,1.18),(0,-.07,1.47),(0,-.18,1.74),(0,-.25,1.95)],
        [.28,.22,.16,.20],'charizard',sides=16)
    b.leaf('Neck_belly',(0,-.28,1.13),(0,-.35,1.83),.13,.033,'char_belly')
    head=b.group('head',(0,-.27,2.04))
    b.sphere('Dragon_head',(0,-.27,2.05),(.255,.31,.20),'charizard',head,28,18)
    b.sphere('Long_snout',(0,-.56,1.98),(.22,.34,.105),'charizard',head,28,16)
    b.sphere('Lower_jaw',(0,-.49,1.91),(.22,.25,.055),'char_belly',head)
    for sign in [-1,1]:
        b.spindle('Backward_horn',[(sign*.19,-.09,2.18),(sign*.24,.045,2.32),(sign*.26,.18,2.43)],[.075,.052,.002],'charizard',head,16)
        b.eye(sign*.224,-.464,2.12,.047,.063,head,'blue_iris',white=True)
        b.tube('Brow_ridge',[(sign*.145,-.486,2.17),(sign*.23,-.468,2.19),(sign*.30,-.405,2.17)],.025,'charizard',head)
        b.sphere('Nostril',(sign*.12,-.778,2.015),(.018,.011,.013),'brown',head,12,8)
        b.leaf('Small_fang',(sign*.16,-.695,1.923),(sign*.16,-.695,1.857),.023,.02,'cream',head)
        arm=b.group('arm_l' if sign<0 else 'arm_r',(sign*.40,-.015,1.24))
        b.spindle('Dragon_arm',[(sign*.37,-.03,1.25),(sign*.58,-.08,1.13),(sign*.66,-.18,1.0)],
            [.13,.10,.09],'charizard',arm)
        for j in range(3):
            x=sign*(.60+j*.057)
            b.leaf('Hand_finger',(x,-.18,1.04),(x+sign*.015,-.25,.94),.034,.03,'charizard',arm)
            b.leaf('Hand_claw',(x+sign*.015,-.25,.96),(x+sign*.025,-.29,.91),.020,.018,'cream',arm)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.34,.03,.46))
        b.sphere('Powerful_haunch',(sign*.36,.035,.36),(.25,.28,.32),'charizard',leg)
        b.sphere('Dragon_foot',(sign*.39,-.09,.14),(.24,.30,.14),'charizard',leg)
        for dx in [-.13,0,.13]:
            b.leaf('Foot_claw',(sign*.39+dx,-.30,.14),(sign*.39+dx,-.45,.055),.045,.037,'cream',leg)
        wing=b.group('wing_l' if sign<0 else 'wing_r',(sign*.41,.20,1.44))
        outline=[(.41,1.44),(.70,1.88),(1.08,2.25),(1.48,1.83),(1.63,1.08),
            (1.48,1.29),(1.31,1.36),(1.12,1.29),(.99,1.07),(.88,1.20),(.71,1.25),(.52,1.16)]
        b.poly('Teal_wing_membrane',[(sign*x,z) for x,z in outline],.225,.025,'wing',wing)
        b.poly('Wing_shadow_panel',[(sign*.72,1.27),(sign*1.08,2.20),(sign*.99,1.10)],.203,.008,'wing_dark',wing)
        edge=[(sign*.41,.19,1.44),(sign*.70,.19,1.88),(sign*1.08,.20,2.25),(sign*1.48,.20,1.83),(sign*1.63,.20,1.08)]
        b.tube('Wing_upper_bone',edge,.044,'charizard',wing)
        for x,z in [(.53,1.18),(.99,1.09),(1.62,1.09)]:
            b.tube('Wing_finger_bone',[(sign*1.08,.19,2.23),(sign*((1.08+x)/2),.188,(2.23+z)/2),(sign*x,.19,z)],.023,'charizard',wing)
    b.tube('Dragon_mouth',[(-.23,-.615,1.925),(0,-.792,1.905),(.23,-.615,1.925)],.01,'brown',head)
    tail=b.group('tail',(0,.28,.48))
    b.spindle('Long_fire_tail',[(0,.27,.49),(.30,.65,.32),(.68,.87,.28),(.97,.96,.43),(1.13,.89,.72),(1.15,.78,1.02)],
        [.25,.22,.17,.12,.085,.045],'charizard',tail,16)
    b.spindle('Tail_flame',[(1.15,.78,.94),(1.15,.78,1.12),(1.11,.78,1.31),(1.22,.78,1.49),(1.16,.78,1.67)],
        [.04,.16,.14,.10,.008],'flame',tail,12)
    b.spindle('Flame_gold_core',[(1.15,.64,1.02),(1.14,.63,1.17),(1.18,.63,1.36),(1.15,.65,1.46)],
        [.035,.085,.06,.006],'flame_core',tail,10)
    b.leaf('Flame_side_tongue',(1.22,.76,1.13),(1.36,.77,1.43),.07,.05,'flame',tail)
    b.leaf('Flame_side_tongue',(1.08,.76,1.11),(.99,.76,1.37),.06,.05,'flame',tail)
    # Bring the flame clear of the right wing in the full-body silhouette.
    for obj in b.coll.objects:
        if obj.type=='MESH' and obj.parent==tail:
            for v in obj.data.vertices:
                world_x=v.co.x+tail.location.x
                v.co.x+=max(0,world_x-.3)*.65
    return b.finish(1.8)
