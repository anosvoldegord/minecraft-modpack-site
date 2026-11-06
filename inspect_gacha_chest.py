import bpy, json
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\anosv\Desktop\minecraft-modpack-site\public\gacha\chest_standard.glb")

meshes = []
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        meshes.append({
            "name": o.name,
            "dimensions": [round(v, 3) for v in o.dimensions],
            "location": [round(v, 3) for v in o.location]
        })

actions = []
for a in bpy.data.actions:
    actions.append({
        "name": a.name,
        "frames": [float(a.frame_range[0]), float(a.frame_range[1])]
    })

print("CHEST_INSPECT=" + json.dumps({
    "materials": [m.name for m in bpy.data.materials],
    "meshes": len(meshes),
    "mesh_samples": meshes[:15],
    "actions": actions
}, ensure_ascii=False))