"""Eevee, Pikachu, and Rowlet. Builder helpers are supplied by the entry script."""

def build_eevee():
    b=Builder('eevee')
    b.sphere('Torso',(0,.18,.64),(.43,.56,.43),'eevee')
    head=b.group('head',(0,-.38,1.21))
    b.sphere('Head',(0,-.38,1.21),(.50,.40,.45),'eevee',head,32,20)
    for sign in [-1,1]:
        ear=b.group('ear_l' if sign<0 else 'ear_r',(sign*.33,-.28,1.50))
        b.leaf('Ear',(sign*.30,-.26,1.48),(sign*.65,-.23,2.24),.185,.095,'eevee',ear,inner='ear_dark')
        b.eye(sign*.215,-.746,1.28,.091,.148,head,'ear_dark')
        b.sphere('Muzzle',(sign*.10,-.755,1.095),(.13,.07,.085),'eevee',head)
    b.poly('Nose',[(-.045,1.145),(.045,1.145),(0,1.10)],-.83,.028,'ink',head,.01)
    b.smile(-.814,1.06,.14,head,'eevee_dark')
    for x in [-.12,.02,.15]:
        b.leaf('Forehead_tuft',(x,-.34,1.52),(x-.07,-.35,1.76-abs(x)*.4),.075,.065,'eevee',head)
    b.sphere('Cream_ruff',(0,-.20,.88),(.49,.39,.25),'cream')
    for i in range(11):
        a=math.tau*i/11
        x,y=math.cos(a)*.38,math.sin(a)*.29-.20
        b.leaf('Ruff_point',(x*.8,(y+.2)*.8-.2,.91),(x*1.2,(y+.2)*1.2-.2,.64+.05*math.cos(a*2)),.115,.105,'cream')
    for side,x in [('l',-.29),('r',.29)]:
        for end,y in [('f',-.34),('b',.48)]:
            leg=b.group('leg_'+side+end,(x,y,.43))
            b.sphere('Leg',(x,y,.35),(.14,.15,.28),'eevee',leg)
            b.sphere('Paw',(x,y-.06,.12),(.17,.23,.12),'eevee',leg)
            for dx in [-.05,.05]:b.tube('Paw_crease',[(x+dx,y-.25,.13),(x+dx,y-.20,.19)],.006,'eevee_dark',leg)
    tail=b.group('tail',(0,.58,.65))
    b.spindle('Bushy_tail',[(0,.55,.65),(.17,.81,.75),(.37,1.03,.96),(.48,1.15,1.19),(.50,1.22,1.39),(.43,1.25,1.59)],
        [.11,.23,.34,.29,.19,.015],'eevee',tail,16,tip_material='cream')
    return b.finish(1.6)

def build_pikachu():
    b=Builder('pikachu')
    body=b.sphere('Torso',(0,.04,.67),(.44,.33,.55),'gold',segments=32,rings=20)
    for v in body.data.vertices:
        v.co.x*=1-.12*(v.co.z/.55)
    head=b.group('head',(0,-.045,1.29))
    b.sphere('Head',(0,-.045,1.29),(.49,.365,.42),'gold',head,32,20)
    for sign in [-1,1]:
        ear=b.group('ear_l' if sign<0 else 'ear_r',(sign*.28,0,1.59))
        b.leaf('Long_black_tipped_ear',(sign*.27,0,1.58),(sign*.60,.015,2.23),.12,.085,'gold',ear,tip_material='ink')
        b.eye(sign*.207,-.378,1.345,.068,.083,head)
        b.sphere('Red_cheek',(sign*.356,-.31,1.17),(.115,.045,.105),'cheek',head)
        arm=b.group('arm_l' if sign<0 else 'arm_r',(sign*.37,-.04,.97))
        b.leaf('Arm',(sign*.36,-.07,.96),(sign*.59,-.20,.58),.14,.115,'gold',arm)
        for dx in [-.045,0,.045]:
            b.sphere('Small_finger',(sign*.53+dx,-.20,.62),(.035,.08,.045),'gold',arm,12,8)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.25,0,.20))
        b.sphere('Foot',(sign*.25,-.07,.105),(.17,.27,.105),'gold',leg)
    b.poly('Nose',[(-.034,1.26),(.034,1.26),(0,1.23)],-.416,.022,'ink',head,.008)
    b.tube('W_mouth',[(-.13,-.393,1.165),(-.06,-.418,1.145),(0,-.425,1.17),(.06,-.418,1.145),(.13,-.393,1.165)],.012,'brown',head)
    tail=b.group('tail',(.27,.25,.55))
    b.poly('Lightning_tail',[(.28,.48),(.62,.76),(.49,.92),(.86,1.14),(.72,1.35),(1.19,1.85),
        (1.29,1.42),(.99,1.17),(1.11,1.01),(.77,.82),(.86,.65),(.43,.40)],.31,.095,'gold',tail,.018)
    b.poly('Tail_brown_root',[(.28,.48),(.62,.76),(.71,.66),(.43,.40)],.31,.103,'brown',tail,.008)
    for z in [.64,.87]:
        b.tube('Back_stripe',[(-.28,.27,z),(0,.365,z-.025),(.28,.27,z)],.057,'brown')
    return b.finish(1.6)

def build_rowlet():
    b=Builder('rowlet')
    head=b.group('head',(0,0,.92))
    b.sphere('Round_owl_body',(0,0,.88),(.63,.48,.68),'rowlet',head,32,20)
    b.sphere('White_belly',(0,-.364,.55),(.39,.105,.31),'white',head)
    for sign in [-1,1]:
        b.sphere('Heart_face_disc',(sign*.222,-.399,1.09),(.30,.095,.365),'white',head,28,18)
        b.eye(sign*.252,-.498,1.13,.075,.115,head)
        wing=b.group('wing_l' if sign<0 else 'wing_r',(sign*.51,0,1.0))
        b.leaf('Drooping_wing',(sign*.52,-.015,1.02),(sign*.55,-.16,.46),.16,.10,'rowlet_wing',wing)
        b.leaf('Wing_feather',(sign*.56,-.075,.78),(sign*.61,-.15,.39),.07,.075,'rowlet',wing)
        b.leaf('Leaf_bow',(sign*.025,-.522,.775),(sign*.35,-.48,.775),.137,.035,'leaf',head)
        b.tube('Leaf_vein',[(sign*.04,-.557,.775),(sign*.19,-.546,.775),(sign*.31,-.51,.775)],.008,'cat_dark',head)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.22,0,.23))
        b.sphere('Foot_pad',(sign*.22,-.05,.13),(.14,.18,.07),'orange',leg)
        for dx in [-.085,0,.085]:
            b.leaf('Toe',(sign*.22+dx*.5,-.05,.14),(sign*.22+dx,-.27,.065),.052,.035,'orange',leg)
    b.sphere('Beak_top',(0,-.515,1.13),(.082,.13,.135),'white',head)
    b.leaf('Orange_beak',(0,-.56,1.065),(0,-.60,.97),.078,.07,'orange',head)
    tail=b.group('tail',(0,.43,.63))
    b.leaf('Leaf_tail',(0,.38,.64),(0,.74,.48),.17,.06,'leaf',tail)
    return b.finish(1.4)
