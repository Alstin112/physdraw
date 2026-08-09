import Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";
import { LineConfig } from "konva/lib/shapes/Line";
import InfiniteCanvas, { InfiniteCanvasAPI } from "./InfiniteCanvas";
import { FullPaperFile } from "../PaperFile";
import { AppMenu } from "../App";
import { CanvasOptionsMenu } from "./CanvasOptionsMenu";
import { notifyOnSet, useObservable } from "../Observables";
import { InputInteractionManager } from "../ScreenInteractionManager";
import { ExtractSchema } from "../lib/serializers";
import { useEffect, useRef, useState } from "react";
import { User } from "../lib/user";
import { Packets } from "../lib/connection";
import { DataConnection } from "peerjs";
export abstract class Widget { }

export abstract class Tool {
    public id: string;
    public name: string;
    public main: CanvasController;
    public selectable = true;
    @notifyOnSet
    public accessor disabled = false;

    constructor(id: string, name: string, main: CanvasController) {
        this.name = name;
        this.id = id;
        this.main = main;
    }

    appearsOnWidget(_widget: Widget | null): boolean {
        return false;
    }

    onHandleStart(_e: KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) {
        return false;
    }

    onHandleMove(_e: KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) {
        return false;
    }

    onHandleEnd(_e: KonvaEventObject<MouseEvent | TouchEvent | PointerEvent>) {
        return false;
    }

    select() { }
    unselect() { }
}

declare module "./../lib/events" {
    interface EventList {
        "history:append": HistorySession;
        "history:undo": HistorySession;
        "history:redo": HistorySession;
        "canvas:clear": undefined;
    }
}

export class DrawHistory {
    static lines: HistorySession[] = [];
    static back = 0;

    static append(session: HistorySession) {
        if (this.back > 0) {
            this.lines.splice(this.lines.length - this.back, this.back);
            this.back = 0;
        }
        this.lines.push(session);
        AppMenu.eventManager.emit("history:append", session);
        AppMenu.requestSaveActivePaper();
        return this;
    }

    static undo(main: CanvasController) {
        if (this.back >= this.lines.length) return;
        let session: HistorySession;
        do {
            session = this.lines[this.lines.length - 1 - this.back];
            this.back++;
        } while (session.undo(main) && this.back < this.lines.length);
        AppMenu.eventManager.emit("history:undo", session);
    }

    static redo(main: CanvasController) {
        if (this.back <= 0) return;
        let session: HistorySession
        do {
            this.back--;
            session = this.lines[this.lines.length - 1 - this.back];
        } while (session.redo(main) && this.back > 0)
        AppMenu.eventManager.emit("history:redo", session);
    }

    static clear() {
        this.lines = [];
        this.back = 0;
    }
}
export class HistorySession {
    inactive = false;
    undo(_main: CanvasController): boolean { return true }
    redo(_main: CanvasController): boolean { return true }
}
export class LineSession extends HistorySession {
    color = new Uint8Array(4);
    width = 2;
    points: Float64Array;
    owner: number;
    id: number = 0;
    constructor(draw: DrawingLine) {
        super();
        const shape = draw.s;
        const rgba = Konva.Util.colorToRGBA(shape.stroke() as string);
        if (rgba) {
            this.color[0] = rgba.r;
            this.color[1] = rgba.g;
            this.color[2] = rgba.b;
            this.color[3] = rgba.a;
        }
        this.width = shape.strokeWidth();
        this.points = new Float64Array(shape.points());
        this.owner = draw.owner;
        this.id = draw.id;
    }

    redo(main: CanvasController) {
        if (this.inactive) {
            this.inactive = false;
            return true;
        }
        const shape = new Konva.Line({
            stroke: `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${this.color[3]})`,
            strokeWidth: this.width,
            lineCap: 'round',
            lineJoin: 'round',
            tension: 0.5,
            points: this.points
        });

        const draw = new DrawingLine(main, shape, this.id)
            .setToStatic();

        draw.owner = this.owner;

        if (AppMenu.network.isOnline()) {
            AppMenu.network.broadcastOrSendToServer(Packets.AddLine, [draw.getPacketData()]);
        }
        return false;
    }

    undo(main: CanvasController) {
        if (AppMenu.network.isOnline()) {
            AppMenu.network.broadcastOrSendToServer(Packets.removeLine, [{ lineId: this.id, owner: this.owner }]);
        }
        const index = main.KonvaStaticDrawings.findIndex(d => d.id === this.id && d.owner === this.owner);
        if (index > -1) {
            main.KonvaStaticDrawings[index].destroy();
            return false;
        }
        return this.inactive = true;
    }

}
export class EraseSession extends HistorySession {
    erasedDrawings: LineSession[] = [];
    constructor() {
        super();
    }
    add(line: LineSession) {
        this.erasedDrawings.push(line);
    }
    redo(main: CanvasController) {
        for (const line of this.erasedDrawings) {
            line.undo(main);
        }
        return false;
    }
    undo(main: CanvasController) {
        for (const line of this.erasedDrawings) {
            line.redo(main);
        }
        return false;
    }
}
export class DrawingLine {
    static idList: number = 0;

    s: Konva.Line;
    main: CanvasController;
    owner: number = AppMenu.canvasController.userId;
    id: number;

    constructor(main: CanvasController, shape: Konva.Line | LineConfig, id: number = DrawingLine.idList++) {
        this.main = main;
        if (shape instanceof Konva.Line) {
            this.s = shape;
        } else {
            this.s = new Konva.Line(shape);
        }
        this.id = id;
    }
    static from(main: CanvasController, config: LineConfig = {}) {
        return new DrawingLine(main, new Konva.Line(config));
    }
    addPoint(x: number, y: number) {
        this.s.points([...this.s.points(), x, y]);
    }
    setToActive(from?: "static") {
        this.main.KonvaActiveDrawings.push(this);
        switch (from) {
            case "static":
                const index = this.main.KonvaStaticDrawings.indexOf(this);
                if (index > -1) {
                    this.main.KonvaStaticDrawings.splice(index, 1);
                }
                this.s.moveTo(this.main.api?.getLayers().activeLayer);
                break;
            default:
                this.main.api?.getLayers().activeLayer?.add(this.s);
        }
        return this;
    }
    setToStatic(from?: "active") {
        this.main.KonvaStaticDrawings.push(this);
        switch (from) {
            case "active":
                const index = this.main.KonvaActiveDrawings.indexOf(this);
                if (index > -1) {
                    this.main.KonvaActiveDrawings.splice(index, 1);
                }
                this.s.moveTo(this.main.api?.getLayers().staticLayer);
                break;
            default:
                this.main.api?.getLayers().staticLayer?.add(this.s);
        }
        return this;
    }
    getLineSession() {
        return new LineSession(this);
    }
    optimizeRecursive(points: number[], start: number, end: number, tolerance: number): number {
        if (end - start <= 2) return -1;
        let maxDistance = 0;
        let index = -1;

        let dx = points[end] - points[start];
        let dy = points[end + 1] - points[start + 1];
        let dl = Math.sqrt(dx * dx + dy * dy);
        if (dl === 0) {
            for (let i = start + 2; i < end; i += 2) {
                const x = points[i] - points[start];
                const y = points[i + 1] - points[start + 1];
                const dist = x * x + y * y;
                if (dist > maxDistance) {
                    maxDistance = dist;
                    index = i;
                }
            }
            if (maxDistance > tolerance * tolerance) return index;
            return -1;
        }
        dx /= dl;
        dy /= dl;
        for (let i = start + 2; i < end; i += 2) {
            const x = points[i] - points[start];
            const y = points[i + 1] - points[start + 1];
            const dist = Math.abs(dy * x - dx * y);
            if (dist > maxDistance) {
                maxDistance = dist;
                index = i;
            }
        }
        if (maxDistance > tolerance) return index;
        return -1;
    }
    optimize(tolerance: number) {
        const points = this.s.points();
        if (points.length <= 4) return this;
        const indices = [0, points.length - 2];
        const search = [[0, points.length - 2]];

        while (search.length > 0) {
            const [start, end] = search.pop()!;
            const index = this.optimizeRecursive(points, start, end, tolerance);
            if (index !== -1) {
                indices.push(index);
                search.push([start, index]);
                search.push([index, end]);
            }
        }
        const finalPoints = [];
        for (const index of indices.sort((a, b) => a - b)) {
            finalPoints.push(points[index], points[index + 1]);
        }

        this.s.points(finalPoints);
        return this;
    }
    destroy() {
        this.s.destroy();
        const i = this.main.KonvaStaticDrawings.indexOf(this);
        if (i > -1) this.main.KonvaStaticDrawings.splice(i, 1);
    }
    getPacketData() {
        const rgba = Konva.Util.colorToRGBA(this.s.stroke() as string);
        const stroke = (rgba ? (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | (rgba.a * 255) : 0);
        return {
            lineId: this.id,
            owner: this.owner,
            points: this.s.points(),
            stroke,
            strokeWidth: this.s.strokeWidth()
        };
    }
}
export class CanvasController {
    @notifyOnSet
    accessor selectedTool: Tool | null = null;
    @notifyOnSet
    accessor users: User[] = [];

    openMenu!: (menu: "settings" | "users" | null) => void;

    tools: Tool[] = [];
    selectedWidget: Widget | null = null;
    api: InfiniteCanvasAPI | null = null;
    userId = 0;

    KonvaStaticDrawings: DrawingLine[] = [];
    KonvaActiveDrawings: DrawingLine[] = [];

    constructor() {
    }

    selectTool(tool: Tool) {
        if (tool.selectable) {
            if (this.selectedTool) {
                this.selectedTool.unselect();
            }
            this.selectedTool = tool;
        }
        tool.select();
    }

    setAPI(api: InfiniteCanvasAPI) {
        this.api = api;

        InputInteractionManager.screenPressCb = () => {
            const stage = this.api?.getStage();
            if (!stage) return false;
            api.setDraggable(true);
            stage.startDrag();
            return true;
        }
        InputInteractionManager.screenReleaseCb = () => {
            if (!this.api) return false;
            const stage = this.api?.getStage();
            if (!stage) return false;
            api.setDraggable(false);
            stage.stopDrag();
            return true;
        }
        InputInteractionManager.drawPressCb = (e) => {
            if (InputInteractionManager.SPenButton) {
                this.selectTool(this.tools.find(t => t.id === "erase")!);
            }
            if (this.selectedTool) {
                this.selectedTool.onHandleStart(e);
            }
        };
        InputInteractionManager.drawMoveCb = (e) => {
            const pointerLayer = this.api?.getLayers().pointerLayer;
            const pos = this.api?.getStage().getRelativePointerPosition();
            if (pointerLayer && pos) {
                pointerLayer.position({ x: pos.x, y: pos.y });
            }
            if (this.selectedTool) {
                this.selectedTool.onHandleMove(e);
            }
        };
        InputInteractionManager.drawReleaseCb = (e) => {
            if (this.selectedTool) {
                this.selectedTool.onHandleEnd(e);
            }
        };
        InputInteractionManager.scrollCb = (e) => {
            e.evt.preventDefault();
            if (!this.api) return;
            const stage = this.api.getStage();
            if (!stage) return;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };
            const scaleBy = 1.1;
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            stage.scale({ x: newScale, y: newScale });
            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            stage.position(newPos);

            if (this.selectedTool) {
                this.selectedTool.onHandleMove(e);
            }
        };

        InputInteractionManager.keyDownCb = (e) => {
            if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                DrawHistory.undo(this);
            }
            if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                DrawHistory.redo(this);
            }
        }

        this.KonvaStaticDrawings.forEach(drawing => {
            this.api!.getLayers().staticLayer?.add(drawing.s);
        });

        this.KonvaActiveDrawings.forEach(drawing => {
            this.api!.getLayers().activeLayer?.add(drawing.s);
        });
    }

    registerTool<T extends Tool>(tool: T): T {
        this.tools.push(tool);
        return tool;
    }

    clear() {
        console.log("Clearing canvas");
        for (let i = this.KonvaActiveDrawings.length - 1; i >= 0; i--) {
            const element = this.KonvaActiveDrawings[i];
            element.destroy();
        }
        for (let i = this.KonvaStaticDrawings.length - 1; i >= 0; i--) {
            const element = this.KonvaStaticDrawings[i];
            element.destroy();
        }
        DrawHistory.clear();
        AppMenu.eventManager.emit("canvas:clear");
    }

    loadFromFullPaper(paper: FullPaperFile) {
        this.clear();
        paper.lines.forEach(line => {
            DrawingLine.from(this, {
                stroke: `#${line.stroke.toString(16).padStart(8, "0")}`,
                strokeWidth: line.strokeWidth,
                points: line.points,
                lineCap: 'round',
                lineJoin: 'round',
                tension: 0.5
            }).setToStatic();
        });
    }

    updateFullPaper(paper: FullPaperFile): void {
        // Saving Lines
        const lines: FullPaperFile["lines"] = [];
        for (const drawing of this.KonvaStaticDrawings) {
            const shape = drawing.s;
            const rgba = Konva.Util.colorToRGBA(shape.stroke() as string);
            const rgbaint = rgba ? (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | (rgba.a * 255) : 0;
            lines.push({
                stroke: rgbaint,
                strokeWidth: shape.strokeWidth(),
                points: shape.points()
            });
        }

        paper.lines = lines;
    }

    importFromPacketData(data: ExtractSchema<typeof Packets.SendPaper["schema"]>) {
        this.clear();
        for (const line of data.lines) {
            new DrawingLine(this, {
                stroke: `#${line.stroke.toString(16).padStart(8, "0")}`,
                strokeWidth: line.strokeWidth,
                points: line.points
            }, line.lineId).setToStatic();
        }
        this.userId = data.userId;
        console.log(data.userId)
    }
    exportToPacketData(peerId: string): ExtractSchema<typeof Packets.SendPaper["schema"]> {
        const lines: ExtractSchema<typeof Packets.SendPaper["schema"]>["lines"] = [];
        for (const drawing of this.KonvaStaticDrawings) {
            const shape = drawing.s;
            const rgba = Konva.Util.colorToRGBA(shape.stroke() as string);
            let rgbaint = 0;
            if (rgba) {
                rgbaint = (rgba.r << 24) | (rgba.g << 16) | (rgba.b << 8) | (rgba.a * 255);
            }
            lines.push({
                stroke: rgbaint,
                strokeWidth: shape.strokeWidth(),
                points: shape.points(),
                lineId: drawing.id,
                owner: drawing.owner
            });
        }
        const userId = this.users.find(u => u.id === peerId)!.canvasId;
        return { userId, lines };
    }
    addLineFromPacketData(lines: ExtractSchema<typeof Packets.AddLine["schema"]>) {
        for (const { points, stroke, strokeWidth, lineId, owner } of lines) {
            console.log("Adding line from packet data with id:", lineId, "and owner:", owner);
            const lineConfig = {
                points,
                stroke: `#${stroke.toString(16).padStart(8, "0")}`,
                strokeWidth
            }
            const drawing = new DrawingLine(this, lineConfig, lineId).setToStatic();
            drawing.owner = owner;
        }
    }
    eraseLinesFromPacketData(lines: ExtractSchema<typeof Packets.removeLine["schema"]>) {
        for (const { lineId, owner } of lines) {
            console.log("Erasing line from packet data with id:", lineId, "and owner:", owner);
            const index = this.KonvaStaticDrawings.findIndex(d => d.id === lineId && d.owner === owner);
            console.log(this.KonvaStaticDrawings)
            if (index > -1) {
                const drawing = this.KonvaStaticDrawings[index];
                drawing.destroy();
            } else {
                console.warn("Line not found for erasing with id:", lineId, "and owner:", owner);
            }
            console.log(this.KonvaStaticDrawings)
        }
    }
    newJoinRequestPacket(data: ExtractSchema<typeof Packets.JoinRequest["schema"]>, conn: DataConnection) {
        this.users = [...AppMenu.canvasController.users, new User(data.nick, conn.peer)];
    }


}
export function BaseToolButton({ tool }: { tool: Tool }) {
    const disabled = useObservable(tool, "disabled");
    const toolSelected = useObservable(AppMenu.canvasController, "selectedTool");
    const [toolShouldPopup, setToolPopup] = useState(false);
    const isSelected = toolSelected === tool;
    const details = useRef<HTMLDivElement>(null);

    function handleClick() {
        const selectedTool = AppMenu.canvasController.selectedTool;
        if (selectedTool === tool) {
            setToolPopup(!toolShouldPopup);
        } else {
            setToolPopup(false);
            AppMenu.canvasController.selectTool(tool);
        }
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (details.current && !details.current.contains(event.target as Node)) {
                setToolPopup(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    let ToolPopup = null;
    if (toolSelected?.id === tool.id && toolShouldPopup) ToolPopup = AppMenu.pluginRegistry.toolsPopup.get(tool.id);

    return <div className="tool-button">
        <button
            onClick={handleClick}
            disabled={disabled}
            className={isSelected ? "selected" : ""}
        >{tool.name}
        </button>
        {ToolPopup ? <div className="tool-details" ref={details}><ToolPopup /> </div> : null}
    </div>;
}
export function BaseUserRow({ user }: { user: User }) {
    const accepted = useObservable(user, "accepted");
    return <tr>
        <td>{user.name}</td>
        <td>
            <button onClick={() => {
                console.log("Accepting user:", user);
                const conn = AppMenu.network.connections.get(user.id);
                if (conn) {
                    user.accepted = true;
                    user.canvasId = AppMenu.canvasController.users.map(u => u.canvasId).sort((a, b) => a - b).findIndex((id, i) => i + 1 !== id) + 1;
                    AppMenu.network.clientSendPacket(Packets.SendPaper, AppMenu.canvasController.exportToPacketData(conn.peer), conn);
                }
            }} disabled={accepted}>Accept</button>
        </td><td>
            <button>Reject</button>
        </td><td>
            <button>Kick</button>
        </td><td>
            <button>Additional Device</button>
        </td>
    </tr>;
}
export function UsersMenu({ open, close }: { open: boolean, close: () => void }) {
    const users = useObservable(AppMenu.canvasController, "users");
    const dialogRef = useRef<HTMLDialogElement>(null);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (!dialogRef.current) return;

        const rect = dialogRef.current.getBoundingClientRect();

        const clickedOutside =
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom;

        if (clickedOutside) {
            close();
        }
    };
    console.log("Clicked outside the dialog, closing.");

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open) {
            if (dialog.open) return;
            dialog.showModal();
        } else {
            if (!dialog.open) return;
            dialog.close();
        }
    }, [open]);

    return <dialog ref={dialogRef} id="canvas-options-dialog" onClick={handleBackdropClick}>
        <div>
            <div id="canvas-options-menu-header">
                <div></div>
                <button onClick={close}>Close</button>
            </div>
            <div id="canvas-options-menu">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            users.map(user => <BaseUserRow key={user.name} user={user} />)
                        }
                    </tbody>
                </table>
            </div>
        </div>
    </dialog>;
}
export function UsersButton({ onClick }: { onClick: () => void }) {
    return <div id="users">
        <button onClick={onClick}>
            Users
        </button>
        <div id="users-list">
        </div>
    </div>;
}
export function DrawScreen() {
    const [menuOpen, setDialogOpen] = useState<Parameters<typeof AppMenu.canvasController.openMenu>[0]>(null);

    AppMenu.canvasController.openMenu = (menu) => {
        setDialogOpen(menu);
    }

    console.log(menuOpen)

    return (<div id="draw-screen">
        <InfiniteCanvas API={(api) => AppMenu.canvasController.setAPI(api)} />
        <div id="toolbar">
            {AppMenu.canvasController.tools.map(tool =>
                <BaseToolButton key={tool.id} tool={tool} />
            )}
        </div>
        <div id="config">
            <button onClick={() => setDialogOpen(menuOpen === "settings" ? null : "settings")}>
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="1rem" height="1rem" viewBox="0 0 24 24">
                    <path d="M 2 5 L 2 7 L 22 7 L 22 5 L 2 5 z M 2 11 L 2 13 L 22 13 L 22 11 L 2 11 z M 2 17 L 2 19 L 22 19 L 22 17 L 2 17 z"></path>
                </svg>
            </button>
        </div>
        <UsersButton onClick={() => setDialogOpen("users")} />
        {menuOpen === "settings" && <CanvasOptionsMenu open={menuOpen === "settings"} closeModal={() => setDialogOpen(null)} />}
        {menuOpen === "users" && <UsersMenu open={menuOpen === "users"} close={() => setDialogOpen(null)} />}
    </div>)
}