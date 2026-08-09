export class ShapeLogic {
  static id = 0;
  static IntersectionFunctions = new Map<number, (shape1: ShapeLogic, shape2: ShapeLogic, error?: number) => boolean>();
  static ShapeLogicId = new Map<Function, number>();

  intersects(other: ShapeLogic, error?: number): boolean | null {
    return ShapeLogic.intersects(this, other, error);
  }

  static cross(P1: PointLogic, P2: PointLogic, P3: PointLogic): number {
    return (P2.y - P1.y) * (P3.x - P2.x) - (P2.x - P1.x) * (P3.y - P2.y);
  }

  static intersects(shape1: ShapeLogic, shape2: ShapeLogic, err?: number): boolean | null {
    const id1 = ShapeLogic.ShapeLogicId.get(shape1.constructor);
    const id2 = ShapeLogic.ShapeLogicId.get(shape2.constructor);
    if(id1 === undefined || id2 === undefined) return null;
    const key = id1 < id2 ? id2 * (id2 + 1) * 0.5 + id1 : id1 * (id1 + 1) * 0.5 + id2;
    const func = ShapeLogic.IntersectionFunctions.get(key);
    if(func) {
      return id1 > id2 ? func(shape2, shape1,err) : func(shape1, shape2, err);
    }
    return null;
  }

  static RegisterShapeLogicId(shapeLogicClass: Function) {
    if(!ShapeLogic.ShapeLogicId.has(shapeLogicClass)) {
      ShapeLogic.ShapeLogicId.set(shapeLogicClass, ShapeLogic.id++);
    }
  }

  static registerIntersectionFunction<A extends ShapeLogic, B extends ShapeLogic>(Shape1Class: Function, Shape2Class: Function, func: (shape1: A, shape2: B, error?: number) => boolean) {
    const Shape1Id = ShapeLogic.ShapeLogicId.get(Shape1Class);
    const Shape2Id = ShapeLogic.ShapeLogicId.get(Shape2Class);
    if(Shape1Id === undefined || Shape2Id === undefined) {
      throw new Error("ShapeLogic classes must be registered before registering intersection functions.");
    }
    const key = Shape1Id < Shape2Id ? Shape2Id * (Shape2Id + 1) * 0.5 + Shape1Id : Shape1Id * (Shape1Id + 1) * 0.5 + Shape2Id;
    if (Shape1Id <= Shape2Id) {
      ShapeLogic.IntersectionFunctions.set(key, func as (a: ShapeLogic, b: ShapeLogic, err?: number) => boolean);
    } else {
      ShapeLogic.IntersectionFunctions.set(key, ((a, b, err) => func(b as A, a as B, err)));
    }
  }
}

export class PointLogic extends ShapeLogic {

  static {ShapeLogic.RegisterShapeLogicId(PointLogic);}
  static id = ShapeLogic.id++;
  static t1 = new PointLogic(new Float64Array([0, 0]));
  static t2 = new PointLogic(new Float64Array([0, 0]));
  static t3 = new PointLogic(new Float64Array([0, 0]));

  data: Float64Array;
  constructor(data: Float64Array = new Float64Array(2)) {
    super();
    this.data = data;
  }

  static from(x: number, y: number): PointLogic {
    return new PointLogic(new Float64Array([x, y]));
  }

  get x(): number {
    return this.data[0];
  }

  set x(value: number) {
    this.data[0] = value;
  }

  get y(): number {
    return this.data[1];
  }

  set y(value: number) {
    this.data[1] = value;
  }

  set(other: PointLogic): PointLogic {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  add(other: PointLogic): PointLogic {
    if(other instanceof PointLogic) {
      this.x += other.x;
      this.y += other.y;
    } else {
      this.x += other;
      this.y += other;
    }
    return this;
  }

  sub(other: PointLogic): PointLogic {
    if(other instanceof PointLogic) {
      this.x -= other.x;
      this.y -= other.y;
    } else {
      this.x -= other;
      this.y -= other;
    }
    return this;
  }

  scl(other: PointLogic): PointLogic {
    if(other instanceof PointLogic) {
      this.x *= other.x;
      this.y *= other.y;
    } else {
      this.x *= other;
      this.y *= other;
    }
    return this;
  }

  mag2(): number {
    return this.x * this.x + this.y * this.y;
  }

  dot(other: PointLogic): number {
    return this.x * other.x + this.y * other.y;
  }

  area(other: PointLogic): number {
    return this.x * other.y - this.y * other.x;
  }

  toString(): string {
    return `Point(${this.x}, ${this.y})`;
  }

  static {
    ShapeLogic.registerIntersectionFunction(PointLogic, PointLogic, (p1: PointLogic, p2: PointLogic) => {
      return p1.x === p2.x && p1.y === p2.y;
    });
  }
}

export class LineLogic extends ShapeLogic {
  static {ShapeLogic.RegisterShapeLogicId(LineLogic);}
  static t1 = new LineLogic();
  static t2 = new LineLogic();
  static t3 = new LineLogic();

  data: Float64Array;
  constructor(data: Float64Array = new Float64Array(4)) {
    super();
    this.data = data;
  }

  get x1() {return this.data[0]} set x1(value: number) {this.data[0] = value}
  get y1() {return this.data[1]} set y1(value: number) {this.data[1] = value}
  get x2() {return this.data[2]} set x2(value: number) {this.data[2] = value}
  get y2() {return this.data[3]} set y2(value: number) {this.data[3] = value}
  cloneP1(p1: PointLogic) {
    p1.x = this.x1;
    p1.y = this.y1;
    return p1;
  }
  cloneP2(p2: PointLogic) {
    p2.x = this.x2;
    p2.y = this.y2;
    return p2;
  }

  set(other: LineLogic): LineLogic {
    this.data[0] = other.data[0];
    this.data[1] = other.data[1];
    this.data[2] = other.data[2];
    this.data[3] = other.data[3];
    return this;
  }

  static from(x1: number, y1: number, x2: number, y2: number): LineLogic {
    const data = new Float64Array(4);
    data[0] = x1;
    data[1] = y1;
    data[2] = x2;
    data[3] = y2;
    return new LineLogic(data);
  }

  static fromPoints(p1: PointLogic, p2: PointLogic): LineLogic {
    const data = new Float64Array(4);
    data[0] = p1.x;
    data[1] = p1.y;
    data[2] = p2.x;
    data[3] = p2.y;
    return new LineLogic(data);
  }

  static {
    ShapeLogic.registerIntersectionFunction(PointLogic, LineLogic, (p: PointLogic, l: LineLogic) => {
        return ShapeLogic.cross(l.cloneP1(PointLogic.t1), l.cloneP2(PointLogic.t2), p) === 0;
    });
  }
}

export class LineSegmentLogic extends LineLogic {
  static {ShapeLogic.RegisterShapeLogicId(LineSegmentLogic);}

  intersectsLineSegment(other: LineSegmentLogic): boolean {
    const o1 = ShapeLogic.cross(this.cloneP1(PointLogic.t1), this.cloneP2(PointLogic.t2), other.cloneP1(PointLogic.t3));
    const o2 = ShapeLogic.cross(this.cloneP1(PointLogic.t1), this.cloneP2(PointLogic.t2), other.cloneP2(PointLogic.t3));
    const o3 = ShapeLogic.cross(other.cloneP1(PointLogic.t1), other.cloneP2(PointLogic.t2), this.cloneP1(PointLogic.t3));
    const o4 = ShapeLogic.cross(other.cloneP1(PointLogic.t1), other.cloneP2(PointLogic.t2), this.cloneP2(PointLogic.t3));

    if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
      return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
    }

    if (o1 === 0 && other.cloneP1(PointLogic.t3).x >= Math.min(this.x1, this.x2) && other.cloneP1(PointLogic.t3).x <= Math.max(this.x1, this.x2) && other.cloneP1(PointLogic.t3).y >= Math.min(this.y1, this.y2) && other.cloneP1(PointLogic.t3).y <= Math.max(this.y1, this.y2)) return true;
    if (o2 === 0 && other.cloneP2(PointLogic.t3).x >= Math.min(this.x1, this.x2) && other.cloneP2(PointLogic.t3).x <= Math.max(this.x1, this.x2) && other.cloneP2(PointLogic.t3).y >= Math.min(this.y1, this.y2) && other.cloneP2(PointLogic.t3).y <= Math.max(this.y1, this.y2)) return true;
    if (o3 === 0 && this.cloneP1(PointLogic.t3).x >= Math.min(other.x1, other.x2) && this.cloneP1(PointLogic.t3).x <= Math.max(other.x1, other.x2) && this.cloneP1(PointLogic.t3).y >= Math.min(other.y1, other.y2) && this.cloneP1(PointLogic.t3).y <= Math.max(other.y1, other.y2)) return true;
    if (o4 === 0 && this.cloneP2(PointLogic.t3).x >= Math.min(other.x1, other.x2) && this.cloneP2(PointLogic.t3).x <= Math.max(other.x1, other.x2) && this.cloneP2(PointLogic.t3).y >= Math.min(other.y1, other.y2) && this.cloneP2(PointLogic.t3).y <= Math.max(other.y1, other.y2)) return true;
    return false;
  }
  
  static {
    ShapeLogic.registerIntersectionFunction(PointLogic, LineSegmentLogic, (p: PointLogic, ls: LineSegmentLogic) => {
        if(!(ShapeLogic.cross(ls.cloneP1(PointLogic.t1), ls.cloneP2(PointLogic.t2), p) === 0)) return false;
        const minX = Math.min(ls.x1, ls.x2);
        const maxX = Math.max(ls.x1, ls.x2);
        const minY = Math.min(ls.y1, ls.y2);
        const maxY = Math.max(ls.y1, ls.y2);
        return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    });
  }
}

export class RectLogic extends ShapeLogic {
  static {ShapeLogic.RegisterShapeLogicId(RectLogic);}
  data: Float64Array;
  
  constructor(data: Float64Array = new Float64Array(4)) {
    super();
    this.data = data;
  }

  intersectsPoint(point: PointLogic): boolean {
    return point.x >= this.data[0] && point.x <= this.data[2] && point.y >= this.data[1] && point.y <= this.data[3];
  }
}

export class CircleLogic extends ShapeLogic {
    static {ShapeLogic.RegisterShapeLogicId(CircleLogic);}

    constructor(public center: PointLogic, public radius: number) {
        super();
    }

    static {
        ShapeLogic.registerIntersectionFunction(PointLogic, CircleLogic, (p: PointLogic, c: CircleLogic) => {
            const dx = p.x - c.center.x;
            const dy = p.y - c.center.y;
            return dx * dx + dy * dy <= c.radius * c.radius;
        });

        ShapeLogic.registerIntersectionFunction(LineSegmentLogic, CircleLogic, (ls: LineSegmentLogic, c: CircleLogic) => {
            const dx = ls.x2 - ls.x1;
            const dy = ls.y2 - ls.y1;
            if(dx === 0 && dy === 0) {
                const distX = ls.x1 - c.center.x;
                const distY = ls.y1 - c.center.y;
                return distX * distX + distY * distY <= c.radius * c.radius;
            }
            const t1 = ((c.center.x - ls.x1) * dx + (c.center.y - ls.y1) * dy) / (dx * dx + dy * dy);
            const t = Math.max(0, Math.min(1, t1));
            const closestX = ls.x1 + t * dx;
            const closestY = ls.y1 + t * dy;
            const distX = closestX - c.center.x;
            const distY = closestY - c.center.y;
            return distX * distX + distY * distY <= c.radius * c.radius;
        });
        ShapeLogic.registerIntersectionFunction(CircleLogic, CircleLogic, (c1: CircleLogic, c2: CircleLogic) => {
            const dx = c1.center.x - c2.center.x;
            const dy = c1.center.y - c2.center.y;
            const distanceSquared = dx * dx + dy * dy;
            const radiusSum = c1.radius + c2.radius;
            return distanceSquared <= radiusSum * radiusSum;
        });
    }
}

console.log("ShapeLogic.ts loaded");