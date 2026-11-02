# RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
# Artifact layout only: no Finder scripting or changes to global preferences.
from pathlib import Path

application = defines['application']
guide = defines['guide']
app_name = Path(application).name
files = [application, (guide, 'Leia-me.txt')]
symlinks = {'Aplicativos': '/Applications'}
hide = ['Leia-me.txt']
# No hidden-extension flag: it is stored as com.apple.FinderInfo on the bundle,
# which strict signature checks (and the in-app updater) reject.
hide_extensions = []
icon = str(Path(application) / 'Contents/Resources/electron.icns')
background = defines['background']
format = 'UDZO'
compression_level = 9
filesystem = 'HFS+'
window_rect = ((160, 180), (760, 480))
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
default_view = 'icon-view'
include_icon_view_settings = True
arrange_by = None
grid_spacing = 80.0
icon_size = 144
text_size = 13
label_pos = 'bottom'
scroll_position = (0, 0)
icon_locations = {app_name: (200, 256), 'Aplicativos': (560, 256)}
