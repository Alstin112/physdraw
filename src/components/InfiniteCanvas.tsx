import { Konva } from 'konva/lib/_FullInternals';
import { KonvaEventObject } from 'konva/lib/Node';
import { useState, useRef, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { InputInteractionManager } from '../ScreenInteractionManager';

export interface InfiniteCanvasAPI {
  onHandleStart(cb: (e: KonvaEventObject<MouseEvent | TouchEvent>) => void): void;
  onHandleMove(cb: (e: KonvaEventObject<MouseEvent | TouchEvent>) => void): void;
  onHandleEnd(cb: (e: KonvaEventObject<MouseEvent | TouchEvent>) => void): void;
  onWheel(cb: (e: KonvaEventObject<WheelEvent>) => void): void;
  onKeyDown(cb: (e: KeyboardEvent) => void): void;
  setDraggable(value: boolean): void;
  getStage(): Konva.Stage;
  getLayers(): {
    staticLayer: Konva.Layer | null;
    activeLayer: Konva.Layer | null;
    pointerLayer: Konva.Layer | null;
  };
}

interface InfiniteCanvasProps {
  API?: (api: InfiniteCanvasAPI) => void;
}

export default function InfiniteCanvas({ API }: InfiniteCanvasProps) {

  const stageRef = useRef<Konva.Stage | null>(null);
  const [draggable, setDraggable] = useState(false);
  const staticLayerRef = useRef<Konva.Layer | null>(null);
  const activeLayerRef = useRef<Konva.Layer | null>(null);
  const pointerLayerRef = useRef<Konva.Layer | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!API) return;
    
    const activeListeners: ({ events: string, cb: any })[] = [];
    const windowListeners: { type: string; cb: any }[] = [];
    
    function subscribe(events: string, cb: any) {
      stage!.on(events, cb);
      activeListeners.push({ events, cb });
      
      return () => {
        stage!.off(events, cb);
        const index = activeListeners.findIndex(l => l.events === events && l.cb === cb);
        if (index !== -1) {
          activeListeners.splice(index, 1);
        }
      }
    }
    

    API({
      onHandleStart: (cb) => subscribe("mousedown touchstart", cb),
      onHandleMove: (cb) => subscribe("mousemove touchmove", cb),
      onHandleEnd: (cb) => subscribe("mouseup touchend", cb),
      onWheel: (cb) => subscribe("wheel", cb),
      onKeyDown: (cb) => {
        console.log("Adding keydown listener");
        window.addEventListener("keydown", cb as EventListener);
        windowListeners.push({ type: "keydown", cb: cb as EventListener });
      },
      setDraggable: (value) => setDraggable(value),
      getStage: () => stageRef.current!,
      getLayers: () => ({
        staticLayer: staticLayerRef.current,
        activeLayer: activeLayerRef.current,
        pointerLayer: pointerLayerRef.current,
      }),
    });

    return () => {
      for (const { events, cb } of activeListeners) {
        stage!.off(events, cb);
      }
      for (const { type, cb } of windowListeners) {
        window.removeEventListener(type, cb);
      }
    };
  }, [API]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed' }}>
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        draggable={draggable}

        onPointerDown={InputInteractionManager.handlePointerDown}
        onPointerMove={InputInteractionManager.handlePointerMove}
        onPointerUp={InputInteractionManager.handlePointerUp}

        onWheel={InputInteractionManager.handleWheel}
      >
        <Layer ref={staticLayerRef} />
        <Layer ref={activeLayerRef} />
        <Layer ref={pointerLayerRef} />
      </Stage>
    </div>
  );
}