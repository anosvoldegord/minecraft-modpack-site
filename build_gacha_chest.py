import bpy, math, os
from mathutils import Vector

# ------------------------------------------------------------
# SCENE
# ------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for block in bpy.data.materials:
    bpy.data.materials.remove(block)

def material(name, color, metallic=0.0, roughness=0.4):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True

    tree = m.node_tree
    if tree is None:
        raise RuntimeError("Material node tree unavailable: " + name)

    bs = next(
        (node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'),
        None
    )

    if bs is None:
        bs = tree.nodes.new(type='ShaderNodeBsdfPrincipled')

    output = next(
        (node for node in tree.nodes if node.type == 'OUTPUT_MATERIAL'),
        None
    )

    if output is None:
        output = tree.nodes.new(type='ShaderNodeOutputMaterial')

    if not any(link.from_node == bs and link.to_node == output for link in tree.links):
        tree.links.new(bs.outputs['BSDF'], output.inputs['Surface'])

    bs.inputs['Base Color'].default_value = (*color, 1.0)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness

    return m

wood = material("01 | Dark aged walnut", (0.20, 0.075, 0.027), 0, .34)
wood_light = material("02 | Warm walnut grain", (0.37, 0.15, 0.055), 0, .38)
wood_dark = material("03 | Deep wood seams", (0.065, 0.022, 0.009), 0, .52)
gold = material("04 | Antique polished gold", (0.83, 0.48, 0.12), .82, .22)
gold_light = material("05 | Gold highlights", (1.0, 0.76, 0.31), .72, .18)
gold_dark = material("06 | Recessed bronze", (0.25, 0.105, 0.025), .78, .3)
iron = material("07 | Dark forged iron", (0.035, 0.045, 0.055), .85, .27)
gem = material("08 | Amber magical crystal", (0.95, 0.39, 0.035), .35, .16)
inner = material("09 | Interior velvet", (0.10, 0.025, 0.018), .05, .7)

def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj

def bevel(obj, width=.04, segments=3):
    mod = obj.modifiers.new("Crafted rounded edges", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod2 = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj

def cube(name, loc, scale, mat, radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, mat)
    if radius:
        bevel(o, radius, 3)
    return o

def uv(name, loc, scale, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=loc
    )
    o = bpy.context.object
    o.name = name
    o.scale = scale
    assign(o, mat)
    bpy.ops.object.shade_smooth()
    return o

def cyl(name, loc, radius, depth, mat, axis='Y', vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc
    )
    o = bpy.context.object
    o.name = name
    if axis == 'Y':
        o.rotation_euler[0] = math.pi / 2
    elif axis == 'X':
        o.rotation_euler[1] = math.pi / 2
    assign(o, mat)
    bevel(o, .012, 2)
    return o

def curve(name, points, mat, radius=.012, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 16
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(points)-1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    assign(ob, mat)
    return ob

def parent_keep_transform(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world

# ------------------------------------------------------------
# MAIN BODY
# ------------------------------------------------------------
cube("Chest | solid structural core", (0, 0, .72), (2.85, 1.72, 1.18), wood, .10)

# Bottom plinth, layered construction
cube("Base | lower shadow plinth", (0, 0, .105), (2.98, 1.84, .19), wood_dark, .045)
cube("Base | carved walnut molding", (0, 0, .205), (2.94, 1.81, .12), wood_light, .035)
cube("Base | gold hairline trim", (0, 0, .275), (2.91, 1.79, .025), gold, .008)

# Front individual boards
for i in range(7):
    x = -1.20 + i*.40
    o = cube(
        "Front | individual oak board %02d" % i,
        (x, -.872, .76),
        (.385, .075, .91),
        wood_light if i % 3 == 0 else wood,
        .025
    )
    # Slight natural color variation
    if i % 2:
        o.data.materials.clear()
        o.data.materials.append(wood)

# Side boards
for side in [-1, 1]:
    for i in range(5):
        y = -.65 + i*.325
        cube(
            "Side | carved board %d %d" % (side, i),
            (side*1.435, y, .74),
            (.07, .31, .88),
            wood_light if i == 2 else wood,
            .022
        )

# Front wood grain: long irregular engraved lines
for i in range(18):
    x = -1.27 + (i % 9)*.30
    z = .40 + (i // 9)*.57
    pts = [
        (x, -.916, z),
        (x+.045, -.919, z+.012),
        (x+.10, -.919, z+.006),
        (x+.17, -.919, z+.018)
    ]
    curve("Wood grain | engraved line %02d" % i, pts,
          wood_dark if i % 2 else wood_light, .0035)

# Front corner reinforced columns
for x in [-1.35, 1.35]:
    cube("Corner | vertical bronze-backed timber", (x, -.91, .78),
         (.13, .10, 1.02), wood_dark, .025)
    cube("Corner | narrow gold inlay", (x, -.968, .78),
         (.035, .012, .92), gold, .008)

# ------------------------------------------------------------
# LID PIVOT AND CURVED BARREL TOP
# ------------------------------------------------------------
pivot = bpy.data.objects.new("ANIMATION | Lid hinge pivot", None)
bpy.context.collection.objects.link(pivot)
pivot.location = (0, .78, 1.30)
pivot.empty_display_type = 'ARROWS'
pivot.empty_display_size = .22

# A true curved solid shell, not a flat box.
# Outer and inner barrel surfaces are joined into one closed mesh.
verts, faces = [], []
nx, nt = 28, 40
half_w = 1.43
r_outer, r_inner = .64, .53
center_z = 1.30
angles = [-math.pi/2 + math.pi*j/nt for j in range(nt+1)]

for radius in [r_outer, r_inner]:
    for j, a in enumerate(angles):
        for i in range(nx+1):
            x = -half_w + 2*half_w*i/nx
            y = radius*math.sin(a)
            z = center_z + radius*math.cos(a)
            verts.append((x, y, z))

layer = (nt+1)*(nx+1)
for j in range(nt):
    for i in range(nx):
        a = j*(nx+1)+i
        b = a+1
        c = a+(nx+1)
        d = c+1
        faces.append((a,b,d,c))
        faces.append((layer+a, layer+c, layer+d, layer+b))

# Side thickness surfaces
for j in [0, nt]:
    for i in range(nx):
        a = j*(nx+1)+i
        b = a+1
        faces.append((a, b, layer+b, layer+a))

# Front and rear end caps
for i in [0, nx]:
    for j in range(nt):
        a = j*(nx+1)+i
        b = (j+1)*(nx+1)+i
        faces.append((a,b,layer+b,layer+a))

mesh = bpy.data.meshes.new("Curved solid barrel lid mesh")
mesh.from_pydata(verts, [], faces)
mesh.materials.append(wood_light)
mesh.update()
lid = bpy.data.objects.new("LID | curved solid walnut shell", mesh)
bpy.context.collection.objects.link(lid)
for p in mesh.polygons:
    p.use_smooth = True
bevel(lid, .018, 2)
parent_keep_transform(lid, pivot)

# Decorative longitudinal wooden ribs following the barrel
for x in [-1.22, -.82, -.41, 0, .41, .82, 1.22]:
    pts = []
    for a in angles:
        r = .645
        pts.append((x, r*math.sin(a), center_z+r*math.cos(a)))
    ob = curve("Lid | raised walnut rib", pts, wood, .018)
    parent_keep_transform(ob, pivot)

# Gold cross straps wrapped over the curved lid
for x in [-1.02, 1.02]:
    pts = []
    for a in angles:
        r = .655
        pts.append((x, r*math.sin(a), center_z+r*math.cos(a)))
    ob = curve("Lid | forged gold cross band", pts, gold, .052)
    parent_keep_transform(ob, pivot)

    pts2 = []
    for a in angles:
        r = .663
        pts2.append((x-.055, r*math.sin(a), center_z+r*math.cos(a)))
    ob2 = curve("Lid | gold band engraved edge", pts2, gold_light, .009)
    parent_keep_transform(ob2, pivot)

# Lid center ornamental inlay
for x in [-.15, 0, .15]:
    pts = []
    for a in angles[3:-3]:
        r = .651
        pts.append((x, r*math.sin(a), center_z+r*math.cos(a)))
    ob = curve("Lid | fine decorative gold fillet", pts, gold_dark, .009)
    parent_keep_transform(ob, pivot)

# Front and rear lip trims
for y in [-.64, .64]:
    ob = cube("Lid | heavy gold lower lip", (0, y, 1.315),
              (2.91, .065, .075), gold, .018)
    parent_keep_transform(ob, pivot)

# ------------------------------------------------------------
# FRONT ARMOR, RIVETS AND LOCK
# ------------------------------------------------------------
cube("Front | upper gold armor rail", (0, -.935, 1.20),
     (2.77, .065, .075), gold, .018)
cube("Front | lower gold armor rail", (0, -.935, .32),
     (2.77, .065, .055), gold_dark, .012)

# Multiple individual rivets
for x in [-1.29, -1.02, -.74, -.47, .47, .74, 1.02, 1.29]:
    for z in [.39, 1.12]:
        uv("Armor | polished gold rivet", (x, -.978, z),
           (.034, .018, .034), gold_light, 16, 10)

# Central lock escutcheon
cube("LOCK | dark recessed backing", (0, -.974, .91),
     (.55, .09, .48), gold_dark, .085)
cube("LOCK | ornate gold faceplate", (0, -1.03, .91),
     (.44, .055, .39), gold, .065)
cube("LOCK | inset bronze center", (0, -1.064, .91),
     (.34, .025, .29), gold_dark, .045)

# Lock keyhole and center gem
uv("LOCK | amber crystal", (0, -1.087, .96),
   (.075, .025, .075), gem, 24, 16)
cyl("LOCK | keyhole ring", (0, -1.087, .84), .055, .025, gold_light)
cube("LOCK | keyhole stem", (0, -1.105, .805),
     (.025, .018, .075), iron, .009)

# Decorative lock rivets
for x in [-.15, .15]:
    for z in [.79, 1.03]:
        uv("LOCK | tiny rivet", (x, -1.10, z),
           (.018, .012, .018), gold_light, 12, 8)

# Ornamental front corner motifs
for side in [-1, 1]:
    for z in [.48, 1.08]:
        pts = [
            (side*1.18, -.975, z),
            (side*1.12, -.979, z+.055),
            (side*1.04, -.979, z+.075),
            (side*.99, -.979, z+.02)
        ]
        curve("Front | engraved ornamental flourish", pts, gold, .012)

# ------------------------------------------------------------
# REAL HINGE HARDWARE AT THE REAR
# ------------------------------------------------------------
for x in [-.94, .94]:
    cube("Hinge | rear mounting plate", (x, .83, 1.22),
         (.28, .07, .31), gold_dark, .035)
    for z in [1.12, 1.30]:
        uv("Hinge | mounting rivet", (x, .875, z),
           (.035, .025, .035), gold_light, 16, 10)

    # hinge barrel
    h = cyl("Hinge | articulated barrel", (x, .82, 1.40),
            .075, .34, gold, 'X')
    parent_keep_transform(h, pivot)

    # two hinge leaves attached to lid
    leaf = cube("Hinge | upper moving leaf", (x, .80, 1.48),
                (.22, .075, .19), gold, .025)
    parent_keep_transform(leaf, pivot)

# ------------------------------------------------------------
# SIDE ORNAMENTS AND CORNER HARDWARE
# ------------------------------------------------------------
for side in [-1, 1]:
    for y in [-.58, .58]:
        cube("Side | corner iron reinforcement",
             (side*1.49, y, .75), (.045, .16, .78), gold_dark, .018)
        for z in [.43, 1.06]:
            uv("Side | corner rivet", (side*1.52, y, z),
               (.018, .03, .03), gold_light, 16, 10)

    # Side medallion
    cyl("Side | ornamental medallion", (side*1.49, 0, .79),
        .19, .055, gold, 'X')
    cyl("Side | medallion inset", (side*1.525, 0, .79),
        .135, .025, gold_dark, 'X')
    uv("Side | crystal centerpiece", (side*1.55, 0, .79),
       (.035, .085, .085), gem, 20, 12)

# ------------------------------------------------------------
# INNER VELVET AND MAGICAL INTERIOR DETAILS
# ------------------------------------------------------------
cube("Interior | velvet bottom lining", (0, 0, 1.28),
     (2.48, 1.37, .025), inner, .018)

# Decorative inner trim visible when opened
for x in [-1.20, 1.20]:
    cube("Interior | gold lining rail", (x, 0, 1.31),
         (.035, 1.35, .035), gold, .008)

# ------------------------------------------------------------
# LIGHTS AND PRESENTATION CAMERA
# ------------------------------------------------------------
world = bpy.context.scene.world
world.color = (.055, .055, .055)

bpy.ops.object.light_add(type='AREA', location=(0, -4.5, 5))
key = bpy.context.object
key.name = "Studio | large warm key light"
key.data.energy = 650
key.data.shape = 'DISK'
key.data.size = 4.0
key.rotation_euler = (math.radians(25), 0, 0)

bpy.ops.object.light_add(type='AREA', location=(3.5, 1.8, 3.5))
rim = bpy.context.object
rim.name = "Studio | gold rim light"
rim.data.energy = 450
rim.data.color = (1.0, .58, .23)
rim.data.size = 3
rim.rotation_euler = (math.radians(35), 0, math.radians(145))

bpy.ops.object.light_add(type='AREA', location=(-3, -1, 2.7))
fill = bpy.context.object
fill.name = "Studio | soft fill"
fill.data.energy = 220
fill.data.size = 3
fill.rotation_euler = (math.radians(55), 0, math.radians(-45))

# ------------------------------------------------------------
# ANIMATION DATA: closed -> open lid
# ------------------------------------------------------------
pivot.rotation_mode = 'XYZ'
pivot.rotation_euler.x = 0
pivot.keyframe_insert(data_path="rotation_euler", frame=1)
pivot.keyframe_insert(data_path="rotation_euler", frame=90)
pivot.rotation_euler.x = math.radians(-112)
pivot.keyframe_insert(data_path="rotation_euler", frame=112)
pivot.keyframe_insert(data_path="rotation_euler", frame=140)

# Blender 5.x compatible animation interpolation.
# Keyframes are already created above; preserve their default Bezier interpolation.
for action in bpy.data.actions:
    try:
        for slot in action.slots:
            try:
                channelbag = action.layers[0].strips[0].channelbag(slot)
                for fc in channelbag.fcurves:
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'BEZIER'
            except (AttributeError, IndexError, TypeError):
                pass
    except (AttributeError, TypeError):
        pass

# ------------------------------------------------------------
# EXPORT GLB
# ------------------------------------------------------------
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.frame_start = 1
scene.frame_end = 140
scene.frame_set(1)

# Select all exportable objects, including animation pivot.
bpy.ops.object.select_all(action='SELECT')

out = os.environ.get("GACHA_OUTPUT")
if not out:
    raise RuntimeError("GACHA_OUTPUT environment variable is missing")

os.makedirs(os.path.dirname(out), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_frame_range=True,
    export_materials='EXPORT',
    export_apply=False
)

print("GACHA_CHEST_EXPORT_OK")
print("OUTPUT:", out)
print("OBJECTS:", len(bpy.context.scene.objects))
print("MATERIALS:", len(bpy.data.materials))