import { useEffect, useState, useSyncExternalStore } from "react";

export function notifyOnSet<T extends Object, V>(
    target: ClassAccessorDecoratorTarget<T, V>,
    context: ClassAccessorDecoratorContext<T, V>
): ClassAccessorDecoratorResult<T, V> {
    const name = String(context.name) as Extract<keyof T, string>;

    return {
        set(value: V) {
            target.set.call(this, value);
            ObservableRegistry.notify(this, name);
        }
    }
}

export abstract class ObservableRegistry {
    private static listeners: WeakMap<Object, Map<string, Set<() => void>>> = new WeakMap();
    private static pendingStaticNotifs = new WeakMap<Object, Set<string>>();
    private static scheduleds = new WeakMap<Object, boolean>();

    private static unsubscribe<T extends Object, K extends Extract<keyof T, string>>(element: T,field: K, cb: () => void) {
        if (!this.listeners.has(element)) return;
        const listeners = this.listeners.get(element)!;
        if (!listeners.has(field)) return;
        listeners.get(field)!.delete(cb);
    }
    public static subscribe<T extends Object, K extends Extract<keyof T, string>>(element: T, field: K) {
        if (!this.listeners.has(element)) {
            this.listeners.set(element, new Map());
        }
        const listeners = this.listeners.get(element)!;
        if (!listeners.has(field)) {
            listeners.set(field, new Set());
        }
        return (cb: () => void) => {
            listeners.get(field)!.add(cb);
            return () => ObservableRegistry.unsubscribe(element, field, cb);
        };
    }
    public static notify<T extends Object, K extends Extract<keyof T, string>>(element: T, field: K) {
        if (!this.pendingStaticNotifs.has(element)) {
            this.pendingStaticNotifs.set(element, new Set());
        }
        this.pendingStaticNotifs.get(element)!.add(field);
        if (this.scheduleds.get(element)) return;
        this.scheduleds.set(element, true);
        queueMicrotask(() => {
            this.scheduleds.set(element, false);
            const pendingNotifsOriginal = this.pendingStaticNotifs.get(element);
            if (!pendingNotifsOriginal) return;
            const listeners = this.listeners.get(element);
            if (!listeners) return;
            const pendingNotifs = new Set(pendingNotifsOriginal);
            pendingNotifsOriginal.clear();
            
            for (const field of pendingNotifs) {
                if (!listeners.has(field)) continue;
                for (const cb of listeners.get(field)!) {
                    cb();
                }
            }
        });
    }

}

export function useObservable<T extends Object, K extends Extract<keyof T, string>>(target: T, property: K): T[K] {
    return useSyncExternalStore(
        ObservableRegistry.subscribe(target, property),
        () => target[property]
    );
}


export function useBufferedObservable<T extends Object, K extends Extract<keyof T, string>>(target: T, property: K): [T[K], (value: T[K]) => void] {
    const value = useObservable(target, property);

    const [buffer, setBuffer] = useState(value);
    useEffect(() => {
        setBuffer(value);
    }, [value]);

    function setValue(value: T[K]) {
        setBuffer(value);
        target[property] = value;
    }

    return [buffer, setValue];
}