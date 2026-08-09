export interface EventList {
    "main:afterInit": undefined;
}

export class EventManager {
  listeners: { [K in keyof EventList]?: ((event: EventList[K]) => void)[] } = {};

  on<T extends keyof EventList>(eventName: T, callback: (event: EventList[T]) => void): () => void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(callback);
    return () => this.off(eventName, callback);
  }

  off<T extends keyof EventList>(eventName: T, callback: (event: EventList[T]) => void): void {
    const index = this.listeners[eventName]?.indexOf(callback);
    if (index !== undefined && index !== -1) {
      this.listeners[eventName]!.splice(index, 1);
    }
  }

  once<K extends keyof EventList>(event: K, callback: (event: EventList[K]) => void): () => void {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  emit<T extends keyof EventList>(eventName: EventList[T] extends undefined ? T : never):  void
  emit<T extends keyof EventList>(eventName: T, event: EventList[T]): void
  emit<T extends keyof EventList>(eventName: T, event?: EventList[T]): void {
    if(!this.listeners[eventName]) return;
    for (const listener of this.listeners[eventName]!) {
      listener(event as EventList[T]);
    }
  }
}