import { AppMenu } from "../App";

export class Shortcuts {
    static shortcuts: { [key: string]: () => void } = {};

    static selectTool(toolId: string) {
        const tool = AppMenu.canvasController.tools.find(t => t.id === toolId);
        if(tool) AppMenu.canvasController.selectTool(tool);
    }
}