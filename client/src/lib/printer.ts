import { API_BASE_URL } from "@/lib/api-config";

// --- ESC/POS Command Constants ---
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMDS = {
    INIT: [ESC, 0x40],
    CUT: [GS, 0x56, 0x42, 0x00],
    TEXT_SIZE: {
        NORMAL: [GS, 0x21, 0x00],
        DOUBLE_HEIGHT: [GS, 0x21, 0x01],
        DOUBLE_WIDTH: [GS, 0x21, 0x10],
        BIG: [GS, 0x21, 0x11], // Double Width + Height
    },
    ALIGN: {
        LEFT: [ESC, 0x61, 0x00],
        CENTER: [ESC, 0x61, 0x01],
        RIGHT: [ESC, 0x61, 0x02],
    },
    FONT: {
        A: [ESC, 0x4D, 0x00],
        B: [ESC, 0x4D, 0x01],
    },
    BOLD: {
        ON: [ESC, 0x45, 0x01],
        OFF: [ESC, 0x45, 0x00],
    }
};

// --- Helper Types ---
interface KOTItem {
    name: string;
    quantity: number;
}

interface KOTData {
    tableNumber: string;
    items: KOTItem[];
    timestamp: string;
    businessUnitId: string;
}

// --- Encoder Class ---
class EscPosBuilder {
    private buffer: number[] = [];

    constructor() {
        this.add(CMDS.INIT);
    }

    add(bytes: number[]) {
        this.buffer.push(...bytes);
        return this;
    }

    text(str: string) {
        // Basic ASCII encoding. For UTF-8/Chinese, we'd need iconv-lite or similar.
        // Assuming English for now as per constraints.
        for (let i = 0; i < str.length; i++) {
            this.buffer.push(str.charCodeAt(i));
        }
        return this;
    }

    newline(count = 1) {
        for (let i = 0; i < count; i++) {
            this.buffer.push(LF);
        }
        return this;
    }

    align(alignment: 'left' | 'center' | 'right') {
        const map = { left: CMDS.ALIGN.LEFT, center: CMDS.ALIGN.CENTER, right: CMDS.ALIGN.RIGHT };
        this.add(map[alignment]);
        return this;
    }

    size(size: 'normal' | 'big') {
        const map = { normal: CMDS.TEXT_SIZE.NORMAL, big: CMDS.TEXT_SIZE.BIG };
        this.add(map[size]);
        return this;
    }

    bold(enabled: boolean) {
        this.add(enabled ? CMDS.BOLD.ON : CMDS.BOLD.OFF);
        return this;
    }

    cut() {
        this.newline(3); // Feed paper a bit
        this.add(CMDS.CUT);
        return this;
    }

    getBuffer() {
        return new Uint8Array(this.buffer);
    }
}

// --- Main Function ---
export async function printKOT(data: KOTData) {
    try {
        console.log("🖨️ Generating KOT for Table:", data.tableNumber);

        const builder = new EscPosBuilder();

        // 1. Header
        builder
            .align('center')
            .size('normal')
            .text('KITCHEN ORDER')
            .newline(2);

        // 2. Table Number (HUGE)
        builder
            .size('big')
            .bold(true)
            .text(`Table: ${data.tableNumber}`)
            .bold(false)
            .size('normal')
            .newline(2);

        // 3. Metadata
        builder
            .align('left')
            .text(`Date: ${new Date().toLocaleString()}`)
            .newline()
            .text(`Unit: ${data.businessUnitId}`) // Requirement: "Business Unit: 2"
            .newline(2);

        // 4. Items Header
        builder
            .text('Qty  Item')
            .newline()
            .text('--------------------------------')
            .newline();

        // 5. Items List
        data.items.forEach(item => {
            // Simple Column formatting
            const qty = item.quantity.toString().padEnd(5);
            const name = item.name.substring(0, 25); // Truncate if too long (32 char width usually)

            builder
                .size('big') // Make items big for chef readability
                .text(`${qty}${name}`)
                .size('normal')
                .newline();
        });

        // 6. Footer
        builder
            .newline()
            .text('--------------------------------')
            .newline(2)
            .cut();

        const payload = builder.getBuffer();

        // 7. Send to Backend Proxy
        // We send base64 to avoid JSON parsing issues with binary
        const base64Payload = btoa(String.fromCharCode(...Array.from(payload)));

        const res = await fetch(`${API_BASE_URL}/api/printer/print-raw`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: base64Payload,
                printerIp: localStorage.getItem('kitchenPrinterIp') || "192.168.1.100"
            }),
        });

        if (!res.ok) throw new Error("Printer Connection Failed");

        return true;

    } catch (error) {
        console.error("❌ Print Failed:", error);
        // Silent fail for UI, or return false
        return false;
    }
}
