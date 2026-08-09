import { KonvaEventObject } from "konva/lib/Node";
import { AppMenu } from "./App";
import { CanvasController, DrawHistory, DrawingLine, EraseSession, Tool, Widget } from "./components/DrawScreen";
import { Packets } from "./lib/connection";
import Konva from "konva";
import { CircleLogic, LineSegmentLogic, PointLogic, ShapeLogic } from "./shapeslogic/shapes";
import { useRef } from "react";
import { PluginRegistry, Plugin } from "./lib/plugins";
import { notifyOnSet, useBufferedObservable } from "./Observables";

export class VanillaPlugin extends Plugin {

	constructor() {
		super();
	}

	init(registry: PluginRegistry) {
        const brushTool = registry.registerTool(new BrushTool(registry.canvasController));
        registry.registerToolPopup("brush", () => <BrushToolPopup brushTool={brushTool} />);
		registry.registerTool(new EraserTool(registry.canvasController));
		const backTool = registry.registerTool(new goBackTool(registry.canvasController));
		const forwardTool = registry.registerTool(new goForwardTool(registry.canvasController));
		AppMenu.eventManager.on("history:append", () => {
			backTool.update();
			forwardTool.update();
		});
		AppMenu.eventManager.on("history:undo", () => {
			backTool.update();
			forwardTool.update();
		});
		AppMenu.eventManager.on("history:redo", () => {
			backTool.update();
			forwardTool.update();
		});
		AppMenu.eventManager.on("canvas:clear", () => {
			backTool.update();
			forwardTool.update();
		});
	}

}
class BrushTool extends Tool {

    @notifyOnSet
    accessor color: string = "#000000ff";
    @notifyOnSet
    accessor size: number = 8;
    
    usedActualColor: boolean = false;

	constructor(main: CanvasController) {
		super("brush", "Brush", main);
	}

	currentLine: DrawingLine | null = null;

	appearsOnWidget(_widget: Widget | null): boolean {
		return true;
	}

	onHandleStart(_e: KonvaEventObject<MouseEvent | TouchEvent>) {
		if (!this.main.api) return false;
		if (!this.main.api.getStage()) return false;
		const stage = this.main.api.getStage();
		if (!stage) return false;
        this.usedActualColor = true;

		const pos = stage.getRelativePointerPosition();
		if (!pos) return false;

		const activeLayer = this.main.api.getLayers().activeLayer;
		if (!activeLayer) return false;

		this.currentLine = new DrawingLine(this.main, {
			stroke: this.color,
			strokeWidth: this.size,
			lineCap: 'round',
			lineJoin: 'round',
			tension: 0.5,
			points: [pos.x, pos.y, pos.x, pos.y]
		}).setToActive("static");
		return true;
	}

	onHandleMove(_e: KonvaEventObject<MouseEvent | TouchEvent>): boolean {
		if (!this.main.api) return false;
		if (!this.currentLine) return false;
		const stage = this.main.api.getStage();
		if (!stage) return false;
		const pos = stage.getRelativePointerPosition();
		if (!pos) return false;
		this.currentLine.addPoint(pos.x, pos.y);
		return true;
	}

	onHandleEnd(e: KonvaEventObject<MouseEvent | TouchEvent>): boolean {
		if (!this.main.api) return false;
		const stage = this.main.api.getStage();
		if (!stage) return false;

		if (e.type === "mouseup" && (e.evt as MouseEvent).button === 1) {
			this.main.api.setDraggable(false);
			stage.stopDrag();
			return true;
		}

		if (!this.currentLine) return false;
		const line = this.currentLine
			.optimize(1 / stage.scaleX())
			.setToStatic("active");

			console.log("Drawing line with id:", line.id, "and owner:", line.owner);

		if (AppMenu.network.isOnline()) {
			const packetData = line.getPacketData();
			AppMenu.network.broadcastOrSendToServer(Packets.AddLine, [packetData]);
		}
		const session = line.getLineSession();
		DrawHistory.append(session);

		this.currentLine = null;
		return true;
	}

}
function BrushToolPopup({brushTool}: {brushTool: BrushTool}) {
    const [color, setColor] = useBufferedObservable(brushTool, "color");
    const [size, setSize] = useBufferedObservable(brushTool, "size");
    console.log(color, size);

    const lastColors = useRef<string[]>([
        "#ff0000ff",
        "#00ff00ff",
        "#0000ffff",
        "#000000ff",
        "#000000ff",
        "#000000ff",
        "#000000ff",
        "#000000ff",
        "#000000ff",
        "#000000ff",
    ]);

    function changeColor(newColor: string) {
        if(newColor.length === 7) {
            newColor += "ff";
        }
        if(brushTool.usedActualColor) {
            console.log("Adding color to last colors:", newColor);
            const index = lastColors.current.indexOf(color);
            if(index !== -1) {
                lastColors.current.splice(index, 1);
            }
            lastColors.current.unshift(color);
            if(lastColors.current.length > 10) {
                lastColors.current.pop();
            }
            brushTool.usedActualColor = false;
        }
        setColor(newColor);
    }

    return <div id="brush-tool-popup">
        <div id="brush-colors">
            <input type="color" name="" id="" value={color} onChange={e => changeColor(e.target.value)}/>
            <div id="last-colors">

                {lastColors.current.map((color, i) => <button key={i} style={{ backgroundColor: color }} onClick={() => setColor(color)}></button>)}
            </div>
        </div>
        <input type="range" name="brush-size" min={1} max={256} defaultValue={8} onChange={(e) => setSize(e.target.valueAsNumber)} />
    </div>
}

class EraserTool extends Tool {

	cursorSymbol: Konva.Circle | null = null;
	lastPos: { x: number, y: number } | null = null;
	eraserSession: EraseSession | null = null;
	lineListErased: { lineId: number, owner: number }[] = [];


	constructor(main: CanvasController) {
		super("eraser", "Eraser", main);
	}

	select() {
		const stage = this.main.api?.getStage();
		if (!stage) return;
		this.cursorSymbol = new Konva.Circle({
			radius: 30,
			fill: "rgba(255, 255, 255, 0.1)",
			stroke: "rgba(0, 0, 0, 0.5)",
			strokeWidth: 2
		});
		this.main.api!.getLayers().pointerLayer?.add(this.cursorSymbol);
	}

	unselect() {
		if (this.cursorSymbol) {
			this.cursorSymbol.destroy();
			this.cursorSymbol = null;
		}
	}

	appearsOnWidget(_widget: Widget | null): boolean {
		return true;
	}

	eraseOnIntersection(eraser: CircleLogic) {
		const line = new LineSegmentLogic();
		for (let drawingid = 0; drawingid < this.main.KonvaStaticDrawings.length; drawingid++) {
			const drawing = this.main.KonvaStaticDrawings[drawingid]
			const shape = drawing.s;
			if (shape instanceof Konva.Line) {
				innerLoop:
				for (let i = 0; i < shape.points().length - 2; i += 2) {
					line.x1 = shape.points()[i];
					line.y1 = shape.points()[i + 1];
					line.x2 = shape.points()[i + 2];
					line.y2 = shape.points()[i + 3];
					if (ShapeLogic.intersects(line, eraser)) {
						console.log("Erasing line with id:", drawing.id, "and owner:", drawing.owner);
						this.lineListErased.push({ lineId: drawing.id, owner: drawing.owner });
						this.eraserSession?.add(drawing.getLineSession());
						drawing.destroy();
						drawingid--;
						break innerLoop;
					}
				}
			}
		}
	}

	// eraseOnIntersection(eraser: CircleLogic) {
	//   const line = new LineSegmentLogic();
	//   console.log("testing Each")
	//   let deletedShapes: DrawingLine[] = [];
	//   let newShapes: DrawingLine[] = [];
	//   for (const drawing of this.main.KonvaStaticDrawings) {
	//     const shape = drawing.s;
	//     console.log("Shape has layer:" + shape.getLayer());
	//     if(shape instanceof Konva.Line) {
	//       const exceptions: number[] = [];
	//       innerLoop:
	//       for (let i = 0; i < shape.points().length - 2; i += 2) {
	//         line.x1 = shape.points()[i];
	//         line.y1 = shape.points()[i + 1];
	//         line.x2 = shape.points()[i + 2];
	//         line.y2 = shape.points()[i + 3];
	//         if (ShapeLogic.intersects(line, eraser)) {
	//           exceptions.push(i);
	//         }
	//       }

	//       if (exceptions.length > 0) {
	//         let newPoints = [];
	//         const p1 = new PointLogic();
	//         const p2 = new PointLogic();
	//         const localNewShapes: Konva.Line[] = [];
	//         const pointsLen = shape.points().length;
	//         for (let i = 0; i < pointsLen-2; i += 2) {
	//           if (exceptions.includes(i)) {
	//             // Exclude the line between this and next
	//             p1.x = shape.points()[i];
	//             p1.y = shape.points()[i + 1];
	//             p2.x = shape.points()[i + 2];
	//             p2.y = shape.points()[i + 3];
	//             const eraseStart = p1.intersects(eraser);
	//             const eraseEnd = p2.intersects(eraser);
	//             const tooClose = (p1.x - p2.x)*(p1.x - p2.x) + (p1.y - p2.y)*(p1.y - p2.y) < eraser.radius*eraser.radius/100;
	//             if((eraseStart && eraseEnd) || tooClose) {
	//               console.log("deleting: "+p1+","+p2+" by to close:" + tooClose);

	//               if(newPoints.length > 0) {
	//                 newPoints.push(p1.x, p1.y);
	//                 const newShape = shape.clone();
	//                 newShape.points(newPoints);
	//                 localNewShapes.push(newShape);
	//                 newPoints = [];
	//               }

	//               continue;
	//             }
	//             // Add new point in the middle;
	//             const midX = (p1.x + p2.x) / 2;
	//             const midY = (p1.y + p2.y) / 2;
	//             console.log("adding mid")
	//             newPoints.push(p1.x, p1.y, midX, midY);
	//           } else {
	//             // Include this line and next
	//             newPoints.push(shape.points()[i], shape.points()[i + 1]);
	//           }
	//         }
	//         p1.x = shape.points()[pointsLen - 4];
	//         p1.y = shape.points()[pointsLen - 3];
	//         p2.x = shape.points()[pointsLen - 2];
	//         p2.y = shape.points()[pointsLen - 1];

	//         if(!(p1.intersects(eraser) && p2.intersects(eraser)) && newPoints.length != 0) {
	//           console.log("addingPoint")
	//           newPoints.push(p2.x,p2.y);
	//         }

	//         if(newPoints.length > 0) {
	//           const newShape = shape.clone();
	//           newShape.points(newPoints);
	//           localNewShapes.push(newShape);
	//         }

	//         let originalIndex = shape.zIndex();
	//         console.log(localNewShapes.length)
	//         for(const newShape of localNewShapes) {
	//           shape.getLayer()?.add(newShape);
	//           newShape.zIndex(originalIndex);
	//           newShapes.push(new DrawingLine(this.main,newShape));
	//         }
	//         shape.destroy();
	//         deletedShapes.push(drawing);
	//       }
	//     }
	//   }
	//   if(deletedShapes.length > 0 || newShapes.length > 0) {
	//     this.main.KonvaStaticDrawings = this.main.KonvaStaticDrawings.filter(s => !deletedShapes.includes(s)).concat(...newShapes);
	//   }
	// }

	onHandleStart(_e: KonvaEventObject<MouseEvent | TouchEvent>) {
		if (!this.main.api) return false;
		if (!this.main.api.getStage()) return false;
		const stage = this.main.api.getStage();
		if (!stage) return false;

		const pos = stage.getRelativePointerPosition();
		if (!pos) return false;
		this.lineListErased = [];
		this.eraserSession = new EraseSession();
		const newPos = PointLogic.from(pos.x, pos.y);
		const eraser = new CircleLogic(newPos, 30 / stage.scaleX());
		this.eraseOnIntersection(eraser);
		this.lastPos = pos;
		return true;
	}

	onHandleMove(_e: KonvaEventObject<MouseEvent | TouchEvent>): boolean {
		const stage = this.main.api!.getStage()!;
		const pos = stage.getRelativePointerPosition()!;
		if (this.cursorSymbol) {
			this.cursorSymbol.radius(30 / stage.scaleX());
			this.cursorSymbol.strokeWidth(2 / stage.scaleX());
		}
		if (!this.lastPos) return false;
		const newPos = PointLogic.from(pos.x, pos.y);
		const eraser = new CircleLogic(newPos, 30 / stage.scaleX());
		this.eraseOnIntersection(eraser);
		this.lastPos = pos;
		return true;
	}

	onHandleEnd(e: KonvaEventObject<MouseEvent | TouchEvent>): boolean {
		if (!this.main.api) return false;
		const stage = this.main.api.getStage();
		if (!stage) return false;

		if (e.type === "mouseup" && (e.evt as MouseEvent).button === 1) {
			this.main.api.setDraggable(false);
			stage.stopDrag();
			return true;
		}
		if (this.lineListErased.length > 0) {
			DrawHistory.append(this.eraserSession!);
			if (AppMenu.network.isOnline()) {
				while(this.lineListErased.length > 0) {
					const chunk = this.lineListErased.splice(0, 255);
					AppMenu.network.broadcastOrSendToServer(Packets.removeLine, chunk);
				}
			}
		}
		this.lastPos = null;

		return false;
	}
}

class goBackTool extends Tool {
	selectable = false;

	constructor(main: CanvasController) {
		super("goBack", "Undo", main);
		this.disabled = true;
	}
	appearsOnWidget(_widget: Widget | null): boolean {
		return true;
	}
	select() {
		DrawHistory.undo(this.main);
		AppMenu.requestSaveActivePaper();
	}
	update() {
		this.disabled = DrawHistory.back === DrawHistory.lines.length;
	}
}

class goForwardTool extends Tool {
	selectable = false;
	constructor(main: CanvasController) {
		super("goForward", "Redo", main);
		this.disabled = true;
	}
	appearsOnWidget(_widget: Widget | null): boolean {
		return true;
	}
	select() {
		DrawHistory.redo(this.main);
		AppMenu.requestSaveActivePaper();
	}

	update() {
		this.disabled = DrawHistory.back === 0;
	}
}