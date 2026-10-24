"""Sprigatito, Piplup, and Jigglypuff."""

def build_sprigatito():
    b=Builder('sprigatito')
    b.sphere('Cat_torso',(0,.22,.57),(.34,.47,.34),'mint')
    head=b.group('head',(0,-.34,1.13))
    b.sphere('Head',(0,-.34,1.13),(.54,.37,.44),'mint',head,32,20)
    for sign in [-1,1]:
        ear=b.group('ear_l' if sign<0 else 'ear_r',(sign*.34,-.21,1.43))
        b.poly('Large_cat_ear',[(sign*.13,1.48),(sign*.61,1.37),(sign*.57,1.91)],-.22,.17,'cat_green',ear,.045)
        b.poly('Pale_inner_ear',[(sign*.25,1.50),(sign*.52,1.46),(sign*.52,1.78)],-.316,.015,'mint',ear,.025)
        for j in range(3):
            b.leaf('Cheek_fur',(sign*.43,-.30,1.11-j*.085),(sign*(.64-j*.045),-.31,1.19-j*.17),.085,.09,'mint',head)
    b.surface_patch('Leaf_face_marking',[(-.31,1.42),(-.17,1.51),(0,1.37),(.17,1.51),(.31,1.42),(.19,1.14),(.25,1.02),(0,1.065),(-.25,1.02),(-.19,1.14)],
        (0,-.34,1.13),(.54,.37,.44),'cat_green',head)
    for sign in [-1,1]:
        b.eye(sign*.258,-.671,1.185,.105,.145,head,'pink_iris',white=True)
        b.sphere('Pale_muzzle',(sign*.105,-.70,1.005),(.145,.052,.085),'mint',head)
    b.poly('Pink_nose',[(-.042,1.075),(.042,1.075),(0,1.037)],-.768,.022,'nose_pink',head,.01)
    b.tube('Kitten_mouth',[(0,-.768,1.037),(0,-.766,1.004),(-.08,-.758,.987)],.008,'cat_dark',head)
    b.tube('Kitten_mouth_other',[(0,-.766,1.004),(.08,-.758,.987)],.008,'cat_dark',head)
    for i,(x,z) in enumerate([(-.25,.76),(0,.62),(.25,.76)]):
        b.leaf('Leaf_neck_ruff',(0,-.53,.88),(x,-.56,z),.105,.045,'cat_dark')
    for side,x in [('l',-.23),('r',.23)]:
        for end,y in [('f',-.28),('b',.48)]:
            leg=b.group('leg_'+side+end,(x,y,.39))
            b.sphere('Slender_leg',(x,y,.28),(.10,.11,.25),'mint',leg)
            b.sphere('Paw',(x,y-.04,.09),(.12,.17,.09),'mint',leg)
    tail=b.group('tail',(0,.56,.62))
    b.spindle('Fluffy_cat_tail',[(0,.54,.62),(.12,.76,.76),(.25,.89,.90),(.38,.94,1.01),(.49,.97,1.06)],
        [.10,.15,.19,.17,.01],'mint',tail,12,tip_material='cat_green')
    return b.finish(1.5)

def build_piplup():
    b=Builder('piplup')
    b.sphere('Pale_blue_body',(0,.025,.58),(.39,.30,.47),'piplup_light',segments=28,rings=18)
    head=b.group('head',(0,-.01,1.20))
    b.sphere('Blue_head',(0,-.01,1.20),(.53,.425,.49),'piplup_blue',head,32,20)
    # Two white facial panels leave the characteristic blue forehead wedge.
    for sign in [-1,1]:
        b.sphere('White_face_panel',(sign*.213,-.355,1.15),(.265,.098,.315),'white',head,28,18)
        b.eye(sign*.226,-.451,1.215,.063,.115,head,'blue_iris')
    b.surface_patch('Blue_forehead_point',[(-.16,1.50),(.16,1.50),(.105,1.30),(0,1.23),(-.105,1.30)],
        (0,-.01,1.20),(.53,.425,.49),'piplup_blue',head)
    b.sphere('Upper_yellow_beak',(0,-.491,1.07),(.126,.14,.086),'beak',head)
    b.sphere('Lower_yellow_beak',(0,-.482,1.018),(.106,.105,.035),'beak',head)
    b.tube('Beak_seam',[(-.092,-.551,1.036),(0,-.61,1.03),(.092,-.551,1.036)],.007,'orange',head)
    b.sphere('Dark_blue_collar',(0,-.055,.83),(.395,.295,.145),'piplup_dark')
    for sign in [-1,1]:
        wing=b.group('wing_l' if sign<0 else 'wing_r',(sign*.32,0,.81))
        b.leaf('Penguin_flipper',(sign*.33,-.015,.80),(sign*.48,-.08,.34),.15,.075,'piplup_blue',wing)
        b.sphere('White_chest_button',(sign*.14,-.287,.61),(.061,.026,.086),'white')
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.205,0,.16))
        b.toe_feet(sign*.205,-.055,.085,'beak',leg)
    tail=b.group('tail',(0,.27,.48))
    b.leaf('Tail_feather_l',(-.03,.27,.47),(-.16,.59,.72),.11,.055,'piplup_blue',tail)
    b.leaf('Tail_feather_r',(.04,.27,.47),(.17,.59,.67),.11,.055,'piplup_blue',tail)
    return b.finish(1.4)

def build_jigglypuff():
    b=Builder('jigglypuff')
    head=b.group('head',(0,0,.78))
    b.sphere('Round_pink_body',(0,0,.78),(.65,.475,.64),'pink',head,36,24)
    for sign in [-1,1]:
        ear=b.group('ear_l' if sign<0 else 'ear_r',(sign*.42,0,1.26))
        b.poly('Pointed_ear',[(sign*.20,1.32),(sign*.60,1.13),(sign*.61,1.66)],.015,.19,'pink',ear,.035)
        b.poly('Dark_inner_ear',[(sign*.34,1.34),(sign*.53,1.24),(sign*.55,1.53)],-.092,.014,'ink',ear,.02)
        b.eye(sign*.275,-.432,.89,.17,.18,head,'teal_iris',white=True)
        arm=b.group('arm_l' if sign<0 else 'arm_r',(sign*.57,0,.65))
        b.leaf('Little_arm',(sign*.56,-.015,.67),(sign*.79,-.03,.75),.10,.095,'pink',arm)
        leg=b.group('leg_l' if sign<0 else 'leg_r',(sign*.32,0,.19))
        b.sphere('Pink_foot',(sign*.32,-.06,.095),(.19,.24,.095),'pink',leg)
    b.smile(-.486,.665,.12,head,'pink_deep')
    # Broad curled forelock, a defining silhouette rather than a separate ball.
    b.spindle('Curled_forelock',[(.18,-.25,1.35),(.07,-.39,1.43),(-.13,-.47,1.39),(-.24,-.50,1.25),(-.17,-.52,1.16),(-.015,-.51,1.23)],
        [.13,.19,.20,.16,.10,.015],'pink',head,16)
    b.tube('Forelock_curl_seam',[(-.21,-.557,1.19),(-.13,-.58,1.16),(-.04,-.565,1.205)],.009,'pink_deep',head)
    return b.finish(1.4)
