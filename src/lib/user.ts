import { notifyOnSet } from "../Observables";

export class User {
    name: string;
    @notifyOnSet
    accessor accepted = false;
    canvasId: number = -1;

    id: string;

    constructor(name: string, id: string) {
        this.name = name;
        this.id = id;
    }
}