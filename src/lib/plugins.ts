import { CanvasController, Tool } from "../components/DrawScreen";

export class PluginRegistry {
    canvasController: CanvasController;
	toolsPopup: Map<string, () => React.JSX.Element> = new Map();
    
	constructor(canvasController: CanvasController) {
        this.canvasController = canvasController;
	}
    
	registerTool<T extends Tool>(tool: T): T {
        return this.canvasController.registerTool(tool);
	}
    
	registerToolPopup(toolName: string, popup: () => React.JSX.Element) {
        this.toolsPopup.set(toolName, popup);
	}
}

export class Plugin {
    constructor() { }
}