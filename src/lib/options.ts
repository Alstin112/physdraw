import { FileManager } from "./services/storage";

export function autosave<T extends Object, V>(
    target: ClassAccessorDecoratorTarget<T, V>,
    context: ClassAccessorDecoratorContext<T, V>
): ClassAccessorDecoratorResult<T, V> {
    const name = String(context.name) as Extract<keyof T, string>;
    
    return {
        init(defaultValue) {
            return Options.get(name, defaultValue);
        },
        set(value: V) {
            target.set.call(this, value);
            Options.set(name, value);
        }
    }
}

export class Options {
    static loadingToMemory = false;
    static requestedToSave = false;
    static memory: { [key: string]: unknown } = {};

    static async load() {
        const config = await FileManager.loadConfig();
        if (config) this.memory = JSON.parse(config);
        if(!(typeof this.memory === "object" && this.memory !== null)) {
            this.memory = {};
        }
        console.log("Loaded options:", this.memory);
    }

    static get<T>(input: string): T | undefined; 
    static get<T>(input: string, ifNotPresent: T): T 
    static get<T>(input: string, ifNotPresent?: T): T | undefined {
        if (ifNotPresent !== undefined && !(input in this.memory)) {
            this.memory[input] = ifNotPresent;
            this.saveOptions();
            return ifNotPresent;
        }
        return this.memory?.[input] as T | undefined;
    }

    static set<T>(input: string, value: T): T {
        this.memory[input] = value;
        this.saveOptions();
        return value;
    }

    static async saveOptionsNow() {
        if (this.memory) {
            this.requestedToSave = false;
            this.loadingToMemory = true;
            const configString = JSON.stringify(this.memory);
            await FileManager.saveConfig(configString);
            this.loadingToMemory = false;
        }
    }

    static async saveOptions() {
        if(this.requestedToSave) return;
        this.requestedToSave = true;
        requestIdleCallback(() => {
            if (this.loadingToMemory) {
                Options.saveOptions();
            } else {
                this.saveOptionsNow();
            }
        });
    }
}