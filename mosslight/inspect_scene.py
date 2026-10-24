import bpy

result = {
    'blender_version': bpy.app.version_string,
    'filepath': bpy.data.filepath,
    'is_dirty': bpy.data.is_dirty,
    'active_scene': bpy.context.scene.name,
    'scenes': [s.name for s in bpy.data.scenes],
    'objects': [{'name': o.name, 'type': o.type, 'location': list(o.location)} for o in bpy.context.scene.objects],
    'render_engine': bpy.context.scene.render.engine,
    'engines': [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items],
    'mcp_addons': [a for a in bpy.context.preferences.addons.keys() if 'mcp' in a.lower()],
}
