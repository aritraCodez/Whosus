import bpy
from pathlib import Path
OUT=Path('D:/my project/whosus/mosslight')
scene=bpy.data.scenes['Mosslight | Studio']
root=bpy.data.objects['Mosslight | Character root']
body=bpy.data.objects['Body | Broad river-stone torso']
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'
prefs.refresh_devices()
for device in prefs.devices:
    device.use=device.type=='OPTIX'
scene.cycles.device='GPU'
# Resume the completed geometry build at the compositor stage.
old=bpy.data.node_groups.get('Mosslight | Gentle optical glow')
if old:
    bpy.data.node_groups.remove(old)
source=(OUT/'build_mosslight.py').read_text(encoding='utf-8')
exec(source[source.index('# Very restrained glow'):])
