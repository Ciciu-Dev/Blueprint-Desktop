const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;

class BlueprintDesklet extends Desklet.Desklet {
    constructor(metadata, id) {
        super(metadata, id);

        this._previousCPU = null;
        this._timer = null;

        this._root = new St.BoxLayout({
            vertical: true,
            style: `
                background-color: rgba(7,12,23,0.86);
                border: 1px solid rgba(96,165,250,0.30);
                border-radius: 18px;
                padding: 20px 24px;
                min-width: 220px;
            `
        });

        this._heading = new St.Label({
            text: "BLUEPRINT / SYSTEM",
            style: "color: #60a5fa; font-size: 11px;"
        });

        this._clock = new St.Label({
            style: `
                color: #f0f6ff;
                font-size: 42px;
                font-weight: bold;
                padding-top: 8px;
            `
        });

        this._date = new St.Label({
            style: `
                color: #91a8c9;
                font-size: 12px;
                padding-bottom: 12px;
            `
        });

        this._root.add_child(this._heading);
        this._root.add_child(this._clock);
        this._root.add_child(this._date);

        this._cpu = this._makeMeter("CPU");
        this._ram = this._makeMeter("MEMORY");

        this.setContent(this._root);
        this._update();

        this._timer = Mainloop.timeout_add_seconds(3, () => {
            this._update();
            return true;
        });
    }

    _makeMeter(name) {
        let section = new St.BoxLayout({
            vertical: true,
            style: "padding-top: 12px;"
        });

        let row = new St.BoxLayout();

        let label = new St.Label({
            text: name,
            style: "color: #9eb3d1; font-size: 12px;"
        });

        let value = new St.Label({
            text: "--",
            style: "color: #60a5fa; font-size: 12px;"
        });

        let spacer = new St.Bin({ x_expand: true });

        row.add_child(label);
        row.add_child(spacer);
        row.add_child(value);

        let track = new St.BoxLayout({
            style: `
                background-color: #1b2d47;
                border-radius: 4px;
                width: 220px;
                height: 5px;
                margin-top: 8px;
            `
        });

        let bar = new St.Widget({
            style: `
                background-color: #3b82f6;
                border-radius: 4px;
                height: 5px;
            `
        });

        bar.set_width(0);
        track.add_child(bar);

        section.add_child(row);
        section.add_child(track);
        this._root.add_child(section);

        return {value, bar};
    }

    _read(path) {
        let [success, bytes] = GLib.file_get_contents(path);
        if (!success)
            throw new Error("Cannot read " + path);
        return ByteArray.toString(bytes);
    }

    _update() {
        let now = GLib.DateTime.new_now_local();

        this._clock.set_text(now.format("%H:%M"));
        this._date.set_text(now.format("%A, %d %B"));

        try {
            let cpuLine = this._read("/proc/stat")
                .split("\n")[0].trim().split(/\s+/);

            let values = cpuLine.slice(1).map(Number);
            let total = values.reduce((a, b) => a + b, 0);
            let idle = values[3] + values[4];

            if (this._previousCPU) {
                let dt = total - this._previousCPU.total;
                let di = idle - this._previousCPU.idle;
                if (dt > 0)
                    this._setMeter(this._cpu,
                        100 * (1 - di / dt));
            }

            this._previousCPU = {total, idle};

            let mem = this._read("/proc/meminfo");
            let totalMem = Number(
                mem.match(/^MemTotal:\s+(\d+)/m)[1]
            );
            let available = Number(
                mem.match(/^MemAvailable:\s+(\d+)/m)[1]
            );

            this._setMeter(this._ram,
                100 * (1 - available / totalMem));

        } catch (error) {
            global.logError(error);
        }
    }

    _setMeter(meter, percent) {
        percent = Math.max(0, Math.min(100, percent));
        meter.value.set_text(Math.round(percent) + "%");
        meter.bar.set_width(Math.round(220 * percent / 100));
    }

    on_desklet_removed() {
        if (this._timer !== null) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
    }
}

function main(metadata, deskletId) {
    return new BlueprintDesklet(metadata, deskletId);
}
