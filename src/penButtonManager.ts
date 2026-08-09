class PenButtonManager {
    static lastButtonsPressed: number = 0;
    static lastPressure: number = 0;
    static wasHoldingPenButton: boolean = false;
    static penButtonPressCb: ((e: PointerEvent) => void) | null = null;
    static penButtonReleaseCb: ((e: PointerEvent) => void) | null = null;

    static penMove(e: PointerEvent) {
        if (e.pointerType !== "pen") return;
        if (e.buttons === PenButtonManager.lastButtonsPressed && e.pressure === PenButtonManager.lastPressure) return;

        if(e.pressure === 0 && e.buttons !== 0) {
            this.wasHoldingPenButton = true;
            if (PenButtonManager.penButtonPressCb) PenButtonManager.penButtonPressCb(e);
        }

        if(this.wasHoldingPenButton && e.buttons === 0) {
            this.wasHoldingPenButton = false;
            if (PenButtonManager.penButtonReleaseCb) PenButtonManager.penButtonReleaseCb(e);
        }

        PenButtonManager.lastButtonsPressed = e.buttons;
        PenButtonManager.lastPressure = e.pressure;
    }
    static setOnPenButtonRelease(callback: (e: PointerEvent) => void) {
        this.penButtonReleaseCb = callback;
    }

    static setOnPenButtonPress(callback: (e: PointerEvent) => void) {
        this.penButtonPressCb = callback;
    }
}