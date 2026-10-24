"""Package only the final Pokémon scenes; retain the full authoring workspace separately."""
import bpy
import json
from pathlib import Path

root=Path('D:/my project/whosus/pokemon')
names=['eevee','pikachu','rowlet','sprigatito','piplup','jigglypuff','togepi','squirtle','charizard']
scenes=[bpy.data.scenes['Pokemon | '+name.title()] for name in names]
characters=root/'characters'
characters.mkdir(exist_ok=True)
for name,scene in zip(names,scenes):
    scene['Description']='Locally modeled stylized 3D recreation using official Pokédex artwork as visual reference.'
    bpy.data.libraries.write(str(characters/(name+'.blend')),{scene},path_remap='RELATIVE',fake_user=True,compress=True)
# Each final scene contains editable parts, a hidden optimized export collection,
# and its studio. Draft scenes and unrelated Mosslight scenes are not packaged.
bpy.data.libraries.write(str(root/'pokemon-roster.blend'),set(scenes),path_remap='RELATIVE',fake_user=True,compress=True)
manifest=json.loads((root/'roster.json').read_text(encoding='utf-8'))
for entry in manifest:
    entry['blend']=str(characters/(entry['id']+'.blend'))
    entry['preview']=str(root/'previews'/(entry['id']+'.png'))
(root/'roster.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
result={'project':str(root/'pokemon-roster.blend'),'scenes':[s.name for s in scenes],
    'individual_blends':[str(characters/(name+'.blend')) for name in names]}
