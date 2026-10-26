// BLUEPRINT LAUNCHER V5 / RELEASE 1.0 - stable, configurable, cached
// Native Cinnamon applet: icons, categories, grid, paging, keyboard controls.
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

const PALETTES = {
    blue: { main: '#2563eb', bright: '#60a5fa', selected: '#1e4275', hover: '#24518b' },
    cyan: { main: '#0891b2', bright: '#67e8f9', selected: '#155e75', hover: '#0e7490' },
    violet: { main: '#7c3aed', bright: '#c4b5fd', selected: '#493080', hover: '#5b399b' }
};

const GRID_COLUMNS = 3;
const PAGE_SIZE = 12;
const CATEGORIES = [
    {key: 'All', label: 'All apps', tokens: []},
    {key: 'Favorites', label: '★ Favorites', tokens: []},
    {key: 'Development', label: 'Development', tokens: ['Development']},
    {key: 'Internet', label: 'Internet', tokens: ['Network', 'WebBrowser', 'Email', 'Chat']},
    {key: 'Games', label: 'Games', tokens: ['Game']},
    {key: 'Utilities', label: 'Utilities', tokens: ['Utility', 'FileManager', 'Archiving']},
    {key: 'Graphics', label: 'Graphics', tokens: ['Graphics', 'Photography']},
    {key: 'Office', label: 'Office', tokens: ['Office', 'Education']},
    {key: 'Media', label: 'Media', tokens: ['AudioVideo', 'Audio', 'Video', 'Player']},
    {key: 'System', label: 'System', tokens: ['System', 'Settings']},
    {key: 'Other', label: 'Other', tokens: []}
];

class BlueprintMenu extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.set_applet_icon_symbolic_name('view-grid-symbolic');
        this.set_applet_label('BLUE');
        this.set_applet_tooltip('BLUEPRINT Launcher 1.0 (V5)');

        this._category = 'All';
        this._selected = 0;
        this._page = 0;
        this._apps = [];
        this._filtered = [];
        this._categoryButtons = new Map();
        this._favorites = new Set();
        this._favoritesPath = GLib.build_filenamev([
            GLib.get_user_config_dir(), 'blueprint-launcher', 'favorites.json'
        ]);
        this._loadFavorites();
        this._cacheValid = false;
        this._appMonitor = null;
        this._appMonitorSignal = 0;
        // Keep the application index between openings, but invalidate it when
        // the desktop's application database changes.
        try {
            if (Gio.AppInfoMonitor && Gio.AppInfoMonitor.get) {
                this._appMonitor = Gio.AppInfoMonitor.get();
                this._appMonitorSignal = this._appMonitor.connect('changed', () => {
                    this._cacheValid = false;
                });
            }
        } catch (error) {
            global.logError(error);
        }
        this.accent = 'blue';
        this.compact = false;
        this.showQuickAccess = true;
        this.enablePinShortcut = true;
        this._colors = PALETTES.blue;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.box.style = `
            background-color: #090f1c;
            border: 1px solid #315b97;
            border-radius: 15px;
            padding: 12px;
        `;

        this._root = new St.BoxLayout({
            vertical: true,
            style: 'width: 535px; spacing: 10px;'
        });
        this.menu.addActor(this._root);
        this._buildLayout();

        // Cinnamon's built-in settings UI: no extra configuration application.
        try {
            this.settings = new Settings.AppletSettings(this, 'blueprint-menu@local', instanceId);
            this.settings.bind('accent', 'accent', () => this._applySettings());
            this.settings.bind('compact', 'compact', () => this._applySettings());
            this.settings.bind('show-quick-access', 'showQuickAccess', () => this._applySettings());
            this.settings.bind('enable-pin-shortcut', 'enablePinShortcut', () => this._applySettings());
        } catch (error) {
            // Keep the launcher usable even if Cinnamon refuses the settings file.
            global.logError(error);
        }
        this._applySettings();

        this.search.clutter_text.connect('text-changed', () => {
            this._selected = 0;
            this._page = 0;
            this._render();
        });
        this.search.clutter_text.connect('key-press-event',
            (_actor, event) => this._onSearchKey(event));

        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) {
                if (!this._cacheValid) {
                    this._loadApps();
                    this._cacheValid = true;
                }
                this._status.set_text('');
                this._category = 'All';
                this._selected = 0;
                this._page = 0;
                this.search.set_text('');
                this._render();
                this.search.grab_key_focus();
            }
        });
    }

    _label(text, style) {
        return new St.Label({text, style});
    }

    _buildLayout() {
        const header = new St.BoxLayout({style: 'spacing: 8px;'});
        this._headerIcon = new St.Icon({
            icon_name: 'view-grid-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 18,
            style: 'color: #60a5fa;'
        });
        header.add_child(this._headerIcon);
        header.add_child(this._label('BLUEPRINT  /  LAUNCHER',
            'font-size: 13px; font-weight: bold; color: #dbeafe;'));
        header.add_child(new St.Bin({x_expand: true}));
        this._versionLabel = this._label('V5  /  1.0', 'color: #60a5fa; font-size: 12px;');
        header.add_child(this._versionLabel);
        this._root.add_child(header);

        const searchRow = new St.BoxLayout({style: 'spacing: 8px;'});
        this.search = new St.Entry({
            hint_text: 'Search applications...',
            can_focus: true,
            track_hover: true,
            style: `
                background-color: #142541;
                border: 1px solid #315b97;
                border-radius: 9px;
                color: #e0edff;
                padding: 10px;
                width: 447px;
            `
        });
        searchRow.add_child(this.search);
        const clearSearch = new St.Button({
            label: '×',
            reactive: true,
            track_hover: true,
            style: `
                background-color: #13243d;
                color: #93c5fd;
                border: 1px solid #315b97;
                border-radius: 9px;
                padding: 10px;
                width: 35px;
            `
        });
        clearSearch.connect('clicked', () => {
            this.search.set_text('');
            this.search.grab_key_focus();
        });
        searchRow.add_child(clearSearch);
        this._root.add_child(searchRow);

        this._quickTitle = this._label('QUICK ACCESS',
            'font-size: 11px; color: #91a8c9; font-weight: bold;');
        this._root.add_child(this._quickTitle);
        const quick = new St.BoxLayout({style: 'spacing: 8px;'});
        this._quickRow = quick;
        this._quickButtons = [];
        this._quickIcons = [];
        [
            ['Files', 'folder-symbolic', 'nemo'],
            ['Terminal', 'utilities-terminal-symbolic', 'x-terminal-emulator'],
            ['Settings', 'preferences-system-symbolic', 'cinnamon-settings'],
            ['Themes', 'preferences-desktop-theme-symbolic', 'cinnamon-settings themes']
        ].forEach(([name, icon, command]) => {
            const tile = new St.BoxLayout({
                vertical: true,
                style: 'spacing: 5px;'
            });
            const quickIcon = new St.Icon({
                icon_name: icon,
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 20,
                x_align: Clutter.ActorAlign.CENTER,
                style: 'color: #60a5fa;'
            });
            tile.add_child(quickIcon);
            this._quickIcons.push(quickIcon);
            tile.add_child(this._label(name,
                'font-size: 11px; color: #dbeafe;'));
            const normal = `
                background-color: #13243d;
                border: 1px solid #274774;
                border-radius: 10px;
                padding: 10px;
                width: 100px;
            `;
            const button = new St.Button({
                child: tile,
                reactive: true,
                track_hover: true,
                style: normal
            });
            button.connect('notify::hover', () => {
                const c = this._colors;
                button.style = this._quickButtonStyle() + (button.hover
                    ? `background-color: ${c.selected};`
                    : '');
            });
            this._quickButtons.push(button);
            button.connect('clicked', () => {
                this.menu.close();
                try {
                    Util.spawnCommandLine(command);
                } catch (e) {
                    global.logError(e);
                }
            });
            quick.add_child(button);
        });
        this._root.add_child(quick);

        this._root.add_child(this._label('APPLICATION LIBRARY',
            'font-size: 11px; color: #91a8c9; font-weight: bold;'));

        const body = new St.BoxLayout({style: 'spacing: 10px;'});
        this._categoriesBox = new St.BoxLayout({
            vertical: true,
            style: 'width: 132px; spacing: 3px;'
        });
        body.add_child(this._categoriesBox);

        const right = new St.BoxLayout({
            vertical: true,
            style: 'width: 370px; spacing: 10px;'
        });
        this._grid = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 7px; min-height: 300px;'
        });
        right.add_child(this._grid);
        const footer = new St.BoxLayout({style: 'spacing: 6px;'});
        this._countLabel = this._label('',
            'color: #91a8c9; font-size: 11px;');
        footer.add_child(this._countLabel);
        footer.add_child(new St.Bin({x_expand: true}));
        this._previous = this._pageButton('◀ Prev', () => this._changePage(-1));
        this._next = this._pageButton('Next ▶', () => this._changePage(1));
        footer.add_child(this._previous);
        footer.add_child(this._next);
        right.add_child(footer);
        const favoritesRow = new St.BoxLayout({style: 'spacing: 8px;'});
        this._pinButton = this._pageButton('☆ Pin selected',
            () => this._toggleFavorite());
        favoritesRow.add_child(this._pinButton);
        favoritesRow.add_child(new St.Bin({x_expand: true}));
        favoritesRow.add_child(this._label('Ctrl+D  ·  Pin / Unpin',
            'color: #8197b9; font-size: 10px;'));
        right.add_child(favoritesRow);
        body.add_child(right);
        this._root.add_child(body);
        this._help = this._label(
            '↑ ↓ ← → Navigate   Enter Open   Ctrl+D Pin   Esc Close',
            'color: #718aaf; font-size: 10px;');
        this._root.add_child(this._help);
        this._status = this._label('', 'color: #fca5a5; font-size: 11px;');
        this._root.add_child(this._status);

        for (const cat of CATEGORIES) {
            const button = new St.Button({
                label: cat.label,
                reactive: true,
                track_hover: true
            });
            button.connect('clicked', () => {
                this._category = cat.key;
                this._selected = 0;
                this._page = 0;
                this._render();
                this.search.grab_key_focus();
            });
            this._categoryButtons.set(cat.key, button);
            this._categoriesBox.add_child(button);
        }
    }

    _quickButtonStyle() {
        return `
            background-color: #13243d;
            border: 1px solid #274774;
            border-radius: 10px;
            padding: ${this.compact ? 6 : 10}px;
            width: 100px;
        `;
    }

    _applySettings() {
        if (!this._root) return;
        this._colors = PALETTES[this.accent] || PALETTES.blue;
        const c = this._colors;
        this._headerIcon.style = `color: ${c.bright};`;
        this._versionLabel.style = `color: ${c.bright}; font-size: 12px;`;
        this.search.style = `
            background-color: #142541;
            border: 1px solid ${c.bright};
            border-radius: 9px;
            color: #e0edff;
            padding: 10px;
            width: 447px;
        `;
        this._quickTitle.visible = this.showQuickAccess;
        this._quickRow.visible = this.showQuickAccess;
        this._quickButtons.forEach(button => {
            button.style = this._quickButtonStyle();
        });
        this._quickIcons.forEach(icon => icon.style = `color: ${c.bright};`);
        this.menu.box.style = `
            background-color: #090f1c;
            border: 1px solid ${c.bright};
            border-radius: 15px;
            padding: 12px;
        `;
        this._help.set_text(this.enablePinShortcut
            ? '↑ ↓ ← → Navigate   Enter Open   Ctrl+D Pin   Esc Close'
            : '↑ ↓ ← → Navigate   Enter Open   Esc Close');
        this._render();
    }

    _pageButton(text, action) {
        const b = new St.Button({
            label: text,
            reactive: true,
            track_hover: true,
            style: `
                background-color: #142541;
                color: #dbeafe;
                border: 1px solid #28456f;
                border-radius: 7px;
                padding: 6px 9px;
                font-size: 11px;
            `
        });
        b.connect('clicked', action);
        return b;
    }

    _loadApps() {
        const seen = new Set();
        this._apps = Gio.AppInfo.get_all()
            .filter(app => app.should_show() && app.get_name())
            .filter(app => {
                const id = app.get_id() || app.get_name();
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .map(app => {
                let categories = [];
                try {
                    let info = app;
                    if (typeof info.get_categories !== 'function' &&
                        Gio.DesktopAppInfo && app.get_id()) {
                        info = Gio.DesktopAppInfo.new(app.get_id()) || app;
                    }
                    if (typeof info.get_categories === 'function') {
                        categories = (info.get_categories() || '')
                            .split(';').filter(Boolean);
                    }
                    // Fallback for GJS builds that expose only Gio.AppInfo:
                    // read the installed desktop entry with GLib (no package needed).
                    if (categories.length === 0 && app.get_id()) {
                        const dirs = [GLib.get_user_data_dir(),
                            ...GLib.get_system_data_dirs()];
                        for (const dir of dirs) {
                            const path = GLib.build_filenamev([
                                dir, 'applications', app.get_id()]);
                            if (!GLib.file_test(path, GLib.FileTest.EXISTS))
                                continue;
                            const file = new GLib.KeyFile();
                            file.load_from_file(path, GLib.KeyFileFlags.NONE);
                            categories = (file.get_string(
                                'Desktop Entry', 'Categories') || '')
                                .split(';').filter(Boolean);
                            break;
                        }
                    }
                } catch (e) {
                    // Apps with missing/invalid categories remain in Other.
                }
                const groups = CATEGORIES.filter(cat => cat.tokens.length > 0)
                    .filter(cat => cat.tokens.some(token =>
                        categories.includes(token)))
                    .map(cat => cat.key);
                if (groups.length === 0) groups.push('Other');
                const name = app.get_name();
                const description = app.get_description() || '';
                return {app, name, groups,
                    searchText: `${name} ${description}`.toLowerCase()};
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    _render() {
        const query = this.search.get_text().trim().toLocaleLowerCase();
        this._filtered = this._apps.filter(entry => {
            const categoryOK = this._category === 'All' ||
                (this._category === 'Favorites' &&
                 this._favorites.has(this._appKey(entry))) ||
                entry.groups.includes(this._category);
            const searchOK = !query || entry.searchText.includes(query);
            return categoryOK && searchOK;
        });

        // Favorites appear first in All apps and within search results.
        if (this._category === 'All') {
            this._filtered.sort((a, b) =>
                Number(this._favorites.has(this._appKey(b))) -
                Number(this._favorites.has(this._appKey(a))) ||
                a.name.localeCompare(b.name));
        }

        if (this._filtered.length === 0) {
            this._selected = 0;
            this._page = 0;
        } else {
            this._selected = Math.max(0, Math.min(
                this._selected, this._filtered.length - 1));
            this._page = Math.floor(this._selected / PAGE_SIZE);
        }
        this._renderCategories(query);
        this._renderGrid();
    }

    _renderCategories(query) {
        // One scan rather than one full application scan per category.
        const counts = new Map(CATEGORIES.map(cat => [cat.key, 0]));
        for (const entry of this._apps) {
            if (query && !entry.searchText.includes(query)) continue;
            counts.set('All', counts.get('All') + 1);
            if (this._favorites.has(this._appKey(entry)))
                counts.set('Favorites', counts.get('Favorites') + 1);
            for (const group of entry.groups)
                counts.set(group, (counts.get(group) || 0) + 1);
        }
        const c = this._colors;
        for (const cat of CATEGORIES) {
            const b = this._categoryButtons.get(cat.key);
            b.set_label(`${cat.label}  ${counts.get(cat.key) || 0}`);
            const selected = this._category === cat.key;
            b.style = `
                background-color: ${selected ? c.main : '#101b2f'};
                color: ${selected ? '#ffffff' : '#a9bfdf'};
                border: 1px solid ${selected ? c.bright : '#1c304e'};
                border-radius: 7px;
                padding: ${this.compact ? 4 : 6}px 7px;
                font-size: 11px;
            `;
        }
    }

    _renderGrid() {
        this._grid.destroy_all_children();
        const c = this._colors;
        if (this._filtered.length === 0) {
            this._grid.add_child(this._label(
                this._category === 'Favorites' && !this.search.get_text()
                    ? 'No favorites yet — pin an app from All apps'
                    : 'No matching applications',
                'color: #91a8c9; padding: 18px;'));
            this._countLabel.set_text('0 apps');
            this._previous.reactive = false;
            this._next.reactive = false;
            this._updateFavoriteAction();
            return;
        }

        const start = this._page * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, this._filtered.length);
        for (let offset = start; offset < end; offset += GRID_COLUMNS) {
            const row = new St.BoxLayout({style: 'spacing: 7px;'});
            for (let i = offset; i < Math.min(offset + GRID_COLUMNS, end); i++) {
                const entry = this._filtered[i];
                const tile = new St.BoxLayout({
                    vertical: true,
                    style: 'spacing: 5px;'
                });
                let icon;
                if (entry.app.get_icon()) {
                    icon = new St.Icon({
                        gicon: entry.app.get_icon(),
                        icon_type: St.IconType.FULLCOLOR,
                        icon_size: 27,
                        x_align: Clutter.ActorAlign.CENTER
                    });
                } else {
                    icon = new St.Icon({
                        icon_name: 'application-x-executable',
                        icon_type: St.IconType.FULLCOLOR,
                        icon_size: 27,
                        x_align: Clutter.ActorAlign.CENTER
                    });
                }
                tile.add_child(icon);
                const displayName =
                    (this._favorites.has(this._appKey(entry)) ? '★ ' : '') +
                    entry.name;
                const shortName = displayName.length > 13
                    ? displayName.slice(0, 12) + '…' : displayName;
                tile.add_child(this._label(shortName,
                    'color: #dbeafe; font-size: 11px;'));
                const selected = i === this._selected;
                const normal = `
                    background-color: ${selected ? c.selected : '#13243d'};
                    border: 1px solid ${selected ? c.bright : '#274774'};
                    border-radius: 9px;
                    padding: ${this.compact ? 6 : 10}px 5px;
                    width: 100px;
                    transition-duration: 120;
                `;
                const button = new St.Button({
                    child: tile,
                    reactive: true,
                    track_hover: true,
                    style: normal
                });
                button.connect('notify::hover', () => {
                    button.style = normal + (button.hover
                        ? `background-color: ${this._colors.hover};` : '');
                });
                button.connect('clicked', () => this._launchApp(entry.app));
                row.add_child(button);
            }
            this._grid.add_child(row);
        }
        const pages = Math.ceil(this._filtered.length / PAGE_SIZE);
        this._countLabel.set_text(
            `${this._filtered.length} apps  ·  ${this._page + 1}/${pages}`);
        this._previous.reactive = this._page > 0;
        this._next.reactive = this._page < pages - 1;
        this._updateFavoriteAction();
    }

    _appKey(entry) {
        return entry.app.get_id() || entry.name;
    }

    _loadFavorites() {
        try {
            if (!GLib.file_test(this._favoritesPath, GLib.FileTest.EXISTS))
                return;
            const [ok, bytes] = GLib.file_get_contents(this._favoritesPath);
            if (!ok) return;
            const values = JSON.parse(ByteArray.toString(bytes));
            if (Array.isArray(values)) {
                this._favorites = new Set(values.filter(v =>
                    typeof v === 'string' && v.length < 256));
            }
        } catch (e) {
            global.logError(e);
        }
    }

    _saveFavorites() {
        try {
            const folder = GLib.path_get_dirname(this._favoritesPath);
            if (GLib.mkdir_with_parents(folder, 448) < 0)
                throw new Error('Unable to create favourites folder');
            const result = GLib.file_set_contents(this._favoritesPath,
                JSON.stringify(Array.from(this._favorites), null, 2));
            if (result === false)
                throw new Error('Unable to save favourites');
            return true;
        } catch (e) {
            global.logError(e);
            return false;
        }
    }

    _updateFavoriteAction() {
        const current = this._filtered[this._selected];
        if (!current) {
            this._pinButton.set_label('☆ Pin selected');
            this._pinButton.reactive = false;
            return;
        }
        const pinned = this._favorites.has(this._appKey(current));
        this._pinButton.reactive = true;
        this._pinButton.set_label(pinned ? '★ Unpin selected' : '☆ Pin selected');
    }

    _toggleFavorite() {
        const current = this._filtered[this._selected];
        if (!current) return;
        const key = this._appKey(current);
        const wasPinned = this._favorites.has(key);
        if (wasPinned) this._favorites.delete(key);
        else this._favorites.add(key);
        if (!this._saveFavorites()) {
            if (wasPinned) this._favorites.add(key);
            else this._favorites.delete(key);
            return;
        }
        // Preserve the selected application as favourites are reordered.
        this._render();
        const index = this._filtered.findIndex(entry =>
            this._appKey(entry) === key);
        if (index >= 0) {
            this._selected = index;
            this._page = Math.floor(index / PAGE_SIZE);
            this._renderGrid();
        }
        this.search.grab_key_focus();
    }

    _changePage(direction) {
        const maxPage = Math.max(0, Math.ceil(
            this._filtered.length / PAGE_SIZE) - 1);
        const page = Math.max(0, Math.min(maxPage, this._page + direction));
        if (page === this._page) return;
        this._selected = page * PAGE_SIZE;
        this._page = page;
        this._renderGrid();
        this.search.grab_key_focus();
    }

    _moveSelection(delta) {
        if (!this._filtered.length) return;
        this._selected = Math.max(0, Math.min(
            this._filtered.length - 1, this._selected + delta));
        this._page = Math.floor(this._selected / PAGE_SIZE);
        this._renderGrid();
    }

    _onSearchKey(event) {
        const key = event.get_key_symbol();
        const ctrl = Boolean(event.get_state() &
            Clutter.ModifierType.CONTROL_MASK);
        if (this.enablePinShortcut && ctrl &&
            (key === Clutter.KEY_d || key === Clutter.KEY_D)) {
            this._toggleFavorite();
            return Clutter.EVENT_STOP;
        }
        // PageUp/PageDown navigate the grid without scanning all apps again.
        if (key === Clutter.KEY_Page_Down || key === Clutter.KEY_KP_Page_Down) {
            this._changePage(1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Page_Up || key === Clutter.KEY_KP_Page_Up) {
            this._changePage(-1);
            return Clutter.EVENT_STOP;
        }
        let delta = null;
        if (key === Clutter.KEY_Down || key === Clutter.KEY_KP_Down)
            delta = GRID_COLUMNS;
        if (key === Clutter.KEY_Up || key === Clutter.KEY_KP_Up)
            delta = -GRID_COLUMNS;
        if (key === Clutter.KEY_Right || key === Clutter.KEY_KP_Right)
            delta = 1;
        if (key === Clutter.KEY_Left || key === Clutter.KEY_KP_Left)
            delta = -1;
        if (delta !== null) {
            this._moveSelection(delta);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            const current = this._filtered[this._selected];
            if (current) this._launchApp(current.app);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Escape) {
            this.menu.close();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _launchApp(app) {
        try {
            const launched = app.launch([], null);
            if (launched === false)
                throw new Error('Application launch returned false');
            this.menu.close();
        } catch (error) {
            global.logError(error);
            this._status.set_text('Unable to launch that application.');
        }
    }

    on_applet_removed_from_panel() {
        if (this._appMonitor && this._appMonitorSignal) {
            this._appMonitor.disconnect(this._appMonitorSignal);
            this._appMonitorSignal = 0;
        }
        if (this.settings && typeof this.settings.finalize === 'function')
            this.settings.finalize();
    }

    on_applet_clicked() {
        this.menu.toggle();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new BlueprintMenu(orientation, panelHeight, instanceId);
}
