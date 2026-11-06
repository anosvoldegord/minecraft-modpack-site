import bpy
import os
import json
import shutil
from mathutils import Vector

source = "C:\\Users\\anosv\\Desktop\\minecraft-modpack-site\\public\\gacha\\chest_standard.glb"
output = "C:\\Users\\anosv\\Desktop\\minecraft-modpack-site\\public\\gacha\\chest_standard_repaired.glb"
backup = "C:\\Users\\anosv\\AppData\\Local\\Temp\\chest_standard_before_hinge_fix.glb"

shutil.copy2(source, backup)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)

targets = (
    "LID | curved solid walnut shell",
    "Lid | fine decorative gold fillet",
    "Lid | forged gold cross band",
    "Lid | gold band engraved edge",
    "Lid | raised walnut rib",
)

fixed = []

bpy.context.view_layer.update()

for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue

    if not any(obj.name.startswith(prefix) for prefix in targets):
        continue

    # Переводим мировое смещение в локальные координаты меша.
    world_delta = Vector((0.0, -0.78, -1.30))
    local_delta = obj.matrix_world.to_3x3().inverted() @ world_delta

    for vertex in obj.data.vertices:
        vertex.co += local_delta

    obj.data.update()
    fixed.append(obj.name)

if len(fixed) < 10:
    raise RuntimeError(
        "Найдено слишком мало деталей крышки: " + str(len(fixed))
    )

bpy.context.view_layer.update()

report = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    if not any(obj.name.startswith(prefix) for prefix in targets):
        continue

    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    report.append({
        "name": obj.name,
        "min": [round(min(v[i] for v in corners), 4) for i in range(3)],
        "max": [round(max(v[i] for v in corners), 4) for i in range(3)],
    })

bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_animations=True
)

if not os.path.exists(output) or os.path.getsize(output) < 100000:
    raise RuntimeError("Экспорт GLB не прошёл проверку размера")

print("HINGE_REPAIR_OK")
print("FIXED_MESHES:", len(fixed))
print("FIXED_NAMES:", json.dumps(fixed, ensure_ascii=False))
print("REPAIRED_BOUNDS:", json.dumps(report, ensure_ascii=False))
print("OUTPUT_SIZE:", os.path.getsize(output))