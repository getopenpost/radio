extends SceneTree
# Headless probe: prints surface material names for the tree GLB so the
# prop restyle map can target the canopy and trunk materials by name.
# Run: godot --headless --path . --script res://tools/probe_tree.gd


func _init() -> void:
	for path in ["res://assets/kaykit-tree-1.glb", "res://assets/house-1.glb", "res://assets/bell-tower.glb", "res://assets/bicycle.glb"]:
		var inst: Node3D = (load(path) as PackedScene).instantiate()
		root.add_child(inst)
		print("PROBE ", path)
		for node in inst.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			for s in mi.mesh.get_surface_count():
				var m := mi.mesh.surface_get_material(s) as Material
				print("PROBE   surface %d material '%s'" % [s, m.resource_name if m else "<none>"])
		root.remove_child(inst)
		inst.free()
	quit(0)
