import { KonvaEventObject } from "konva/lib/Node";

type KP = KonvaEventObject<PointerEvent>
type KM = KonvaEventObject<MouseEvent>
type KT = KonvaEventObject<TouchEvent>

export class InputInteractionManager {

    static penMode: boolean = false;
    static firstTimePen: boolean = true;

    // Compability with SPen
    static SPenMode: boolean = true;
    static lastButtonsPressed: number = 0;
    static lastPressure: number = 0;
    static SPenButton: boolean = false;

    // CALLBACKS

    static drawPressCb: ((e: KP | KM | KT) => void) | null = null;
    static drawMoveCb: ((e: KP | KM | KT) => void) | null = null;
    static drawReleaseCb: ((e: KP | KM | KT) => void) | null = null;

    static cancelDrawCb: (() => void) | null = null;

    static screenPressCb: ((e: KM | KT) => void) | null = null;
    static screenMoveCb: ((e: KM | KT) => void) | null = null;
    static screenReleaseCb: ((e: KM | KT) => void) | null = null;

    static scrollCb: ((e: KonvaEventObject<WheelEvent>) => void) | null = null;
    static touchMoveCb: ((e: KT) => void) | null = null;

    static keyDownCb: ((e: KeyboardEvent) => void) | null = null;
    static keyUpCb: ((e: KeyboardEvent) => void) | null = null;
    static keyPressCb: ((e: KeyboardEvent) => void) | null = null;

    // Handlers

    static handlePointerDown(e: KonvaEventObject<PointerEvent>) {
        const IIM = InputInteractionManager;
        switch (e.evt.pointerType) {
            case "pen": {
                if (IIM.firstTimePen) {
                    IIM.firstTimePen = false;
                    IIM.penMode = true;
                }
                IIM.drawPressCb?.(e);
                return;
            }
            case "touch": {
                if (IIM.penMode) {
                    IIM.screenPressCb?.(e);
                } else {
                    IIM.drawPressCb?.(e);
                }
                return;
            }
            case "mouse": {
                if (e.evt.button === 1) {
                    IIM.screenPressCb?.(e);
                } else {
                    IIM.drawPressCb?.(e);
                }
                return;
            }
            default: {
                console.log(`Pointer down event is from an unknown pointer type (${e.evt.pointerType}), ignoring.`);
            }
        }
    }
    static handlePointerMove(e: KonvaEventObject<PointerEvent>) {
        const IIM = InputInteractionManager;
        switch (e.evt.pointerType) {
            case "pen": {
                if (IIM.SPenMode) {
                    InputInteractionManager.SPenMove(e);
                } 
                InputInteractionManager.drawMoveCb?.(e);
                return;
            }
            case "touch": {
                if (IIM.penMode) {
                    IIM.screenMoveCb?.(e);
                } else {
                    IIM.drawMoveCb?.(e);
                }
                return;
            }
            case "mouse": {
                if (e.evt.button === 2) {
                    IIM.screenMoveCb?.(e);
                } else {
                    IIM.drawMoveCb?.(e);
                }
                return;
            }
            default: {
                console.log(`Pointer move event is from an unknown pointer type (${e.evt.pointerType}), ignoring.`);
            }
        }

    }
    static handlePointerUp(e: KonvaEventObject<PointerEvent>) {
        const IIM = InputInteractionManager;
        switch (e.evt.pointerType) {
            case "pen": {
                IIM.drawReleaseCb?.(e);
                return;
            }
            case "touch": {
                if (IIM.penMode) {
                    IIM.screenReleaseCb?.(e);
                } else {
                    IIM.drawReleaseCb?.(e);
                }
                return;
            }
            case "mouse": {
                if (e.evt.button === 1) {
                    IIM.screenReleaseCb?.(e);
                } else {
                    IIM.drawReleaseCb?.(e);
                }
                return;
            }
            default: {
                console.log(`Pointer up event is from an unknown pointer type (${e.evt.pointerType}), ignoring.`);
            }
        }
    }


    static handleWheel(e: KonvaEventObject<WheelEvent>) {
        InputInteractionManager.scrollCb?.(e);
    }

    static handleKeyDown(e: KeyboardEvent) {
        this.keyDownCb?.(e);
    }
    static handleKeyUp(e: KeyboardEvent) {
        this.keyUpCb?.(e);
    }
    static handleKeyPress(e: KeyboardEvent) {
        this.keyPressCb?.(e);
    }


    static SPenMove(e: KP) {
        if (e.evt.pointerType !== "pen") return;
        if (e.evt.buttons === InputInteractionManager.lastButtonsPressed && e.evt.pressure === InputInteractionManager.lastPressure) return;

        if (e.evt.pressure === 0 && e.evt.buttons !== 0) {
            this.SPenButton = true;
            if (InputInteractionManager.drawPressCb) InputInteractionManager.drawPressCb(e);
        }

        if (this.SPenButton && e.evt.buttons === 0) {
            this.SPenButton = false;
            if (InputInteractionManager.drawReleaseCb) InputInteractionManager.drawReleaseCb(e);
        }

        InputInteractionManager.lastButtonsPressed = e.evt.buttons;
        InputInteractionManager.lastPressure = e.evt.pressure;
    }
}