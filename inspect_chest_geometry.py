import bpy
import json
from mathutils import Vector

path = "C:\\Users\\anosv\\Desktop\\minecraft-modpack-site\\public\\gacha\\chest_standard.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=path)

result = []

for obj in bpy.context.scene.objects:
    if obj.type not in {"MESH", "EMPTY"}:
        continue

    name = obj.name.upper()
    if not any(key in name for key in ["LID", "HINGE", "PIVOT", "BODY"]):
        continue

    world = obj.matrix_world
    entry = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "location": [round(v, 4) for v in world.translation],
        "rotation": [round(v, 4) for v in world.to_euler()],
    }

    if obj.type == "MESH":
        corners = [world @ Vector(c) for c in obj.bound_box]
        entry["bounds_min"] = [round(min(v[i] for v in corners), 4) for i in range(3)]
        entry["bounds_max"] = [round(max(v[i] for v in corners), 4) for i in range(3)]

    result.append(entry)

print("CHEST_GEOMETRY_REPORT")
print(json.dumps(result, ensure_ascii=False, indent=2))