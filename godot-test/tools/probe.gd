extends SceneTree
# Headless probe: prints the fox's bone layout, animation list and material
# names so the facing/restyle logic can be verified without rendering.
# Run: godot --headless --path . --script res://tools/probe.gd


func _init() -> void:
	var fox: Node3D = (load("res://assets/fox.glb") as PackedScene).instantiate()
	root.add_child(fox)
	var skels := fox.find_children("*", "Skeleton3D", true, false)
	if skels.is_empty():
		print("PROBE no skeleton")
	else:
		var skel := skels[0] as Skeleton3D
		var ni := skel.find_bone("Neck1")
		var ti := skel.find_bone("Tail1")
		print("PROBE Neck1=", ni, " Tail1=", ti)
		if ni >= 0 and ti >= 0:
			var n := skel.get_bone_global_rest(ni).origin
			var t := skel.get_bone_global_rest(ti).origin
			print("PROBE neck=", n, " tail=", t)
		print("PROBE bone_count=", skel.get_bone_count())
	var players := fox.find_children("*", "AnimationPlayer", true, false)
	if not players.is_empty():
		print("PROBE animations=", (players[0] as AnimationPlayer).get_animation_list())
	for node in fox.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for s in mi.mesh.get_surface_count():
			var m := mi.mesh.surface_get_material(s) as Material
			print("PROBE surface %d material '%s'" % [s, m.resource_name if m else "<none>"])
	quit(0)
